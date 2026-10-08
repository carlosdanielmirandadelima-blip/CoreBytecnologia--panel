import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { runBackup, restoreVolumeBackup, assertInsideBackupDir } from "@/lib/backup";
import { writeAudit } from "@/lib/audit";

/**
 * Operações sobre um backup específico: enviar de novo para a nuvem,
 * restaurar, baixar e excluir.
 */

/** POST — ações: reupload (para todos os provedores com autoBackup). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const backup = await prisma.backup.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = String(body.action || "");

  try {
    if (action === "restore") {
      await restoreVolumeBackup(backup.id, { wipeExisting: false });
      await writeAudit(req, {
        action: "backup.restore",
        resource: "backup",
        resourceId: backup.id,
        details: `Backup "${backup.fileName}" restaurado`,
        user,
      });
      return NextResponse.json({ ok: true, message: "Backup restaurado" });
    }

    if (action === "recreate") {
      // Recria o arquivo a partir da origem (útil quando o arquivo foi perdido).
      const result = await runBackup({
        name: backup.name,
        type: backup.type,
        source: backup.source,
        scheduleId: backup.scheduleId ?? undefined,
      });
      return NextResponse.json({ ok: true, id: result.id, fileName: result.fileName });
    }

    return NextResponse.json({ error: "Ação inválida (use restore ou recreate)" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na operação";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE — remove o backup e o arquivo. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const backup = await prisma.backup.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });

  try {
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      fs.unlinkSync(assertInsideBackupDir(backup.filePath));
    }
  } catch {
    // arquivo já ausente
  }

  await prisma.backup.delete({ where: { id: backup.id } });

  await writeAudit(req, {
    action: "backup.delete",
    resource: "backup",
    resourceId: backup.id,
    details: `Backup "${backup.fileName}" excluído`,
    user,
  });

  return NextResponse.json({ ok: true });
}
