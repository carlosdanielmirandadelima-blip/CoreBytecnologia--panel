/**
 * Worker de agendamento do CoreByte.
 *
 * Antes não existia nenhum agendador no projeto: backups agendados,
 * monitoramento, Dynamic DNS e auto-scaling nunca disparavam sozinhos
 * (os campos nextRun/lastRun ficavam parados e a interface mentia).
 *
 * Este processo roda como um serviço separado (corebyte-worker) e executa
 * as tarefas periódicas. Roda fora do Next.js de propósito: um agendador
 * dentro do servidor web não é confiável (reinicia no deploy, duplica com
 * múltiplas réplicas).
 */

import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import os from "os";
import dns from "dns/promises";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const TICK_MS = Number(process.env.WORKER_TICK_MS || 30000);
let stopping = false;

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function log(msg: string) {
  const stamp = new Date().toISOString();
  console.log(`[worker ${stamp}] ${msg}`);
}

/** Notifica o painel (para o sino de notificações). */
async function notify(title: string, message: string, type: "info" | "warning" | "error" | "success" = "info") {
  try {
    await prisma.notification.create({ data: { title, message: message.slice(0, 1000), type } });
  } catch {
    // notificação não pode derrubar o worker
  }
}

/**
 * Chama uma rota interna do painel autenticando como worker.
 * Usado para reaproveitar a lógica já exposta na API.
 */
async function callInternal(pathname: string, init: RequestInit = {}): Promise<Response | null> {
  const base = process.env.PANEL_URL || "http://panel:3000";
  const token = await getWorkerToken();
  if (!token) return null;
  try {
    const res = await fetch(`${base}${pathname}`, {
      ...init,
      headers: { ...(init.headers || {}), "x-corebyte-worker": token, "Content-Type": "application/json" },
    });
    return res;
  } catch (e) {
    log(`falha ao chamar ${pathname}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

let workerTokenCache: string | null = null;

/** Lê (ou cria) o token interno direto pelo banco. */
async function getWorkerToken(): Promise<string> {
  if (workerTokenCache) return workerTokenCache;
  if (process.env.WORKER_TOKEN) {
    workerTokenCache = process.env.WORKER_TOKEN;
    return workerTokenCache;
  }
  const key = "worker.internal_token";
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing?.value) {
    workerTokenCache = existing.value;
    return workerTokenCache;
  }
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } });
  workerTokenCache = token;
  return token;
}

/* ------------------------------------------------------------------ */
/* 1) Backups agendados                                                */
/* ------------------------------------------------------------------ */

async function runScheduledBackups() {
  const due = await prisma.backupSchedule.findMany({
    where: { enabled: true, nextRun: { lte: new Date() } },
    take: 10,
  });

  for (const schedule of due) {
    log(`executando backup agendado "${schedule.name}"`);
    try {
      const res = await callInternal(`/api/worker/backup`, {
        method: "POST",
        body: JSON.stringify({ scheduleId: schedule.id }),
      });
      if (!res || !res.ok) {
        const text = res ? await res.text().catch(() => "") : "sem resposta";
        throw new Error(text.slice(0, 200) || "falha na chamada");
      }
      const data = (await res.json()) as { ok?: boolean; error?: string; uploaded?: string[] };
      if (data.error) throw new Error(data.error);
      log(`  backup "${schedule.name}" concluído`);
      await notify(
        "Backup concluído",
        `O backup agendado "${schedule.name}" foi concluído${
          data.uploaded?.length ? ` e enviado para ${data.uploaded.join(", ")}` : ""
        }.`,
        "success"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`  falhou: ${msg}`);
      await notify("Falha no backup", `O backup agendado "${schedule.name}" falhou: ${msg}`, "error");
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2) Dynamic DNS                                                      */
/* ------------------------------------------------------------------ */

async function currentPublicIp(): Promise<string | null> {
  const endpoints = ["https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const ip = (await res.text()).trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || ip.includes(":")) return ip;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

async function runDynamicDns() {
  const entries = await prisma.dynamicDns.findMany({ where: { enabled: true } });
  if (!entries.length) return;

  const ip = await currentPublicIp();
  if (!ip) return;

  for (const entry of entries) {
    const waiting = !entry.lastCheck || Date.now() - entry.lastCheck.getTime() >= entry.interval * 1000;
    if (!waiting) continue;

    try {
      await callInternal("/api/worker/dynamic-dns", {
        method: "POST",
        body: JSON.stringify({ id: entry.id, ip }),
      });
      log(`dynamic dns "${entry.hostname}" atualizado para ${ip}`);
    } catch (e) {
      log(`dynamic dns "${entry.hostname}" falhou: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3) Monitores das páginas de status                                  */
/* ------------------------------------------------------------------ */

async function runStatusChecks() {
  const monitors = await prisma.statusMonitor.findMany({ where: { page: { isPublic: true } } });
  const now = Date.now();

  const due = monitors.filter(
    (m) => !m.lastCheck || now - m.lastCheck.getTime() >= m.interval * 1000
  );
  if (!due.length) return;

  // Agrupa por página para aproveitar a rota que checa a página inteira.
  const byPage = new Map<string, string[]>();
  for (const m of due) {
    const list = byPage.get(m.pageId) || [];
    list.push(m.id);
    byPage.set(m.pageId, list);
  }

  for (const [pageId, monitorIds] of Array.from(byPage.entries())) {
    try {
      await callInternal(`/api/worker/status-check`, {
        method: "POST",
        body: JSON.stringify({ pageId, monitorIds }),
      });
      log(`monitoramento da página ${pageId}: ${monitorIds.length} monitor(es) verificado(s)`);
    } catch (e) {
      log(`monitoramento falhou: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4) Auto-scaling                                                     */
/* ------------------------------------------------------------------ */

async function runScalingRules() {
  const rules = await prisma.scalingRule.findMany({ where: { enabled: true } });
  if (!rules.length) return;

  for (const rule of rules) {
    try {
      await callInternal("/api/worker/scaling", {
        method: "POST",
        body: JSON.stringify({ ruleId: rule.id }),
      });
    } catch (e) {
      log(`scaling da regra ${rule.name} falhou: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5) Retenção de backups                                              */
/* ------------------------------------------------------------------ */

async function runRetention() {
  const schedules = await prisma.backupSchedule.findMany({ where: { enabled: true } });
  for (const s of schedules) {
    const all = await prisma.backup.findMany({
      where: { scheduleId: s.id, status: "completed" },
      orderBy: { createdAt: "desc" },
    });
    if (all.length <= s.retention) continue;

    for (const old of all.slice(s.retention)) {
      try {
        if (old.filePath) {
          const fs = await import("fs");
          if (fs.existsSync(old.filePath)) fs.unlinkSync(old.filePath);
        }
      } catch {
        // arquivo já ausente
      }
      await prisma.backup.delete({ where: { id: old.id } });
      log(`retenção: backup "${old.fileName}" removido`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6) Métricas do host (para o painel de servidores)                    */
/* ------------------------------------------------------------------ */

async function updateLocalNodeMetrics() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = ((totalMem - freeMem) / totalMem) * 100;

    // Carga em relação ao número de CPUs.
    const load = os.loadavg()[0];
    const cpus = os.cpus().length || 1;
    const cpuPercent = Math.min(100, (load / cpus) * 100);

    // Uso de disco via df (sem shell: execFile com argumentos fixos).
    let diskPercent = 0;
    try {
      const { stdout } = await execFileAsync("df", ["-P", "/"]);
      const line = stdout.trim().split("\n").pop() || "";
      const parts = line.split(/\s+/);
      if (parts.length >= 5) diskPercent = Number(String(parts[4]).replace("%", "")) || 0;
    } catch {
      // df indisponível
    }

    const local = await prisma.node.findFirst({ where: { isLocal: true } });
    if (local) {
      await prisma.node.update({
        where: { id: local.id },
        data: {
          status: "online",
          cpuPercent: Math.round(cpuPercent * 10) / 10,
          memoryPercent: Math.round(memPercent * 10) / 10,
          diskPercent,
          lastCheck: new Date(),
        },
      });
    }
  } catch {
    // métricas são opcionais
  }
}

/* ------------------------------------------------------------------ */
/* Loop principal                                                      */
/* ------------------------------------------------------------------ */

async function tick() {
  try {
    await runScheduledBackups();
  } catch (e) {
    log(`erro nos backups: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await runStatusChecks();
  } catch (e) {
    log(`erro no monitoramento: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await runDynamicDns();
  } catch (e) {
    log(`erro no dynamic dns: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await runScalingRules();
  } catch (e) {
    log(`erro no scaling: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await runRetention();
  } catch (e) {
    log(`erro na retenção: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await updateLocalNodeMetrics();
  } catch (e) {
    log(`erro nas métricas: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  log("CoreByte worker iniciado");
  log(`intervalo de verificação: ${TICK_MS}ms`);

  // Aguarda o painel subir antes da primeira rodada.
  await new Promise((r) => setTimeout(r, 15000));

  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log("encerrando...");
    stopping = true;
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

main().catch((e) => {
  log(`erro fatal: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

export { dns };
