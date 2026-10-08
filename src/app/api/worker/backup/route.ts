import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkerRequest } from "@/lib/worker-auth";
import { requireSession } from "@/lib/session";
import { runBackup, applyRetention } from "@/lib/backup";
import { decryptConfig } from "@/lib/crypto";
import { createAdapter, describeError } from "@/lib/storage";
import { resolveType } from "@/lib/storage/providers";
import { nextRunFromCron } from "@/lib/cron";

/**
 * Executa um backup agendado e envia para os destinos de nuvem configurados.
 *
 * Só aceita a chamada do worker interno (token compartilhado) ou de um
 * administrador autenticado. Antes, o endpoint equivalente era público e
 * executava comandos de shell montados por string.
 */
export async function POST(req: NextRequest) {
  const fromWorker = await isWorkerRequest(req);
  if (!fromWorker) {
    const { error } = await requireSession();
    if (error) return error;
  }

  const body = (await req.json().catch(() => ({}))) as { scheduleId?: string };
  const scheduleId = String(body.scheduleId || "");
  if (!scheduleId) return NextResponse.json({ error: "Informe o scheduleId" }, { status: 400 });

  const schedule = await prisma.backupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  if (!schedule.enabled) return NextResponse.json({ error: "Agendamento desativado" }, { status: 400 });

  try {
    const result = await runBackup({
      name: schedule.name,
      type: schedule.type,
      source: schedule.source,
      scheduleId: schedule.id,
    });

    // Envia para os provedores marcados para backup automático.
    const uploaded: string[] = [];
    const providers = await prisma.cloudProvider.findMany({ where: { enabled: true } });
    const targets = providers.filter(
      (p) =>
        p.autoBackup ||
        (schedule.cloudDestination && schedule.cloudDestination === p.id)
    );

    for (const provider of targets) {
      try {
        const type = resolveType(provider.type);
        if (!type) continue;
        const adapter = createAdapter(type, decryptConfig(provider.config), provider.folder || undefined, provider.type);
        const remotePath = await adapter.upload(result.filePath, result.fileName);
        await prisma.backup.update({
          where: { id: result.id },
          data: { cloudProviderId: provider.id, remotePath, uploadedAt: new Date() },
        });
        await prisma.cloudProvider.update({
          where: { id: provider.id },
          data: { lastSync: new Date(), lastError: "" },
        });
        uploaded.push(provider.name);
      } catch (e) {
        const message = describeError(e);
        await prisma.cloudProvider.update({
          where: { id: provider.id },
          data: { lastError: message.slice(0, 500) },
        });
      }
    }

    // Aplica a retenção e calcula a próxima execução.
    const removed = await applyRetention(schedule.id, schedule.retention);
    let nextRun: Date | null = null;
    try {
      nextRun = nextRunFromCron(schedule.cron);
    } catch {
      nextRun = null;
    }

    await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: { lastRun: new Date(), nextRun },
    });

    return NextResponse.json({
      ok: true,
      backupId: result.id,
      fileName: result.fileName,
      fileSize: result.size,
      uploaded,
      removedByRetention: removed,
      nextRun,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao executar backup";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
