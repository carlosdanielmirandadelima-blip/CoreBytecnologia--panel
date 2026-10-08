import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkerRequest } from "@/lib/worker-auth";
import { requireSession } from "@/lib/session";
import { checkMonitor } from "@/lib/monitor";

/**
 * Executa as checagens de monitoramento de uma página de status.
 * Chamado pelo worker conforme o intervalo de cada monitor.
 */
export async function POST(req: NextRequest) {
  const fromWorker = await isWorkerRequest(req);
  if (!fromWorker) {
    const { error } = await requireSession();
    if (error) return error;
  }

  const body = (await req.json().catch(() => ({}))) as { pageId?: string; monitorIds?: string[] };
  const pageId = String(body.pageId || "");
  if (!pageId) return NextResponse.json({ error: "Informe o pageId" }, { status: 400 });

  const monitors = await prisma.statusMonitor.findMany({
    where: {
      pageId,
      ...(Array.isArray(body.monitorIds) && body.monitorIds.length
        ? { id: { in: body.monitorIds } }
        : {}),
    },
  });

  const results: unknown[] = [];
  for (const monitor of monitors) {
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

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await prisma.statusCheck.findMany({
        where: { monitorId: monitor.id, createdAt: { gte: since } },
        select: { status: true },
      });
      const up = recent.filter((c) => c.status === "up").length;
      const uptime24h = recent.length ? Math.round((up / recent.length) * 1000) / 10 : 100;

      // Guarda apenas o histórico recente (mantém a tabela pequena).
      const old = await prisma.statusCheck.findMany({
        where: { monitorId: monitor.id },
        orderBy: { createdAt: "desc" },
        skip: 500,
        select: { id: true },
      });
      if (old.length) {
        await prisma.statusCheck.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      }

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
      results.push({ monitor: monitor.name, status: "unknown", error: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
