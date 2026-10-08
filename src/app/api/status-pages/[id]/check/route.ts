import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { isWorkerRequest } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { checkMonitor } from "@/lib/monitor";
import { writeAudit } from "@/lib/audit";

/**
 * Executa as checagens de uma página de status sob demanda.
 *
 * Antes: o TCP era testado com `bash -c 'echo > /dev/tcp/host/port'` e o ping
 * com `ping -c 1 ...`, ambos montados por string — injeção de comando pelo
 * campo `target` do monitor. Agora a checagem usa socket nativo e execFile.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "status-pages.post", resource: "status-pages", details: `Operação post em status-pages` });
  const fromWorker = await isWorkerRequest(req);
  if (!fromWorker) {
    const { error } = await requireSession();
    if (error) return error;
  }

  const page = await prisma.statusPage.findUnique({
    where: { id: params.id },
    include: { monitors: true },
  });
  if (!page) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });

  const results: unknown[] = [];

  for (const monitor of page.monitors) {
    try {
      const result = await checkMonitor(monitor);

      await prisma.statusCheck.create({
        data: {
          status: result.status,
          responseTime: result.responseTime,
          message: result.message,
          monitorId: monitor.id,
        },
      });

      // Mantém somente o histórico recente.
      const old = await prisma.statusCheck.findMany({
        where: { monitorId: monitor.id },
        orderBy: { createdAt: "desc" },
        skip: 500,
        select: { id: true },
      });
      if (old.length) {
        await prisma.statusCheck.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await prisma.statusCheck.findMany({
        where: { monitorId: monitor.id, createdAt: { gte: since } },
        select: { status: true },
      });
      const up = recent.filter((c) => c.status === "up").length;
      const uptime24h = recent.length ? Math.round((up / recent.length) * 1000) / 10 : 100;

      await prisma.statusMonitor.update({
        where: { id: monitor.id },
        data: {
          status: result.status,
          lastCheck: new Date(),
          lastResponse: result.responseTime,
          uptime24h,
        },
      });

      results.push({ monitor: monitor.name, ...result });
    } catch (e) {
      results.push({
        monitor: monitor.name,
        status: "unknown",
        error: e instanceof Error ? e.message : "erro na checagem",
      });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
