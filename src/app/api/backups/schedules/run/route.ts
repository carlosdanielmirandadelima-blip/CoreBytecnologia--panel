import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { isWorkerRequest, getInternalToken } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/**
 * Endpoint legado: executava os agendamentos vencidos montando comandos de
 * shell por string (injeção de comando) e sem autenticação.
 *
 * A execução agora acontece no worker (serviço corebyte-worker), que chama
 * /api/worker/backup. Esta rota permanece como ponte autenticada para quem
 * já a utilizava e apenas encaminha para o executor oficial.
 */
export async function POST(req: NextRequest) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "backups.post", resource: "backups", details: `Operação post em backups` });
  const fromWorker = await isWorkerRequest(req);
  if (!fromWorker) {
    const { error } = await requireSession();
    if (error) return error;
  }

  const due = await prisma.backupSchedule.findMany({
    where: { enabled: true, nextRun: { lte: new Date() } },
    select: { id: true },
    take: 10,
  });

  if (!due.length) {
    return NextResponse.json({ executed: 0, results: [], note: "Nenhum agendamento vencido." });
  }

  const workerKey = await getInternalToken();
  const base = process.env.PANEL_URL || "http://localhost:3000";

  const results: unknown[] = [];
  for (const schedule of due) {
    try {
      const res = await fetch(`${base}/api/worker/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-corebyte-worker": workerKey },
        body: JSON.stringify({ scheduleId: schedule.id }),
      });
      const data = await res.json().catch(() => ({}));
      results.push({ scheduleId: schedule.id, ok: res.ok, ...data });
    } catch (e) {
      results.push({ scheduleId: schedule.id, ok: false, error: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({ executed: results.length, results });
}
