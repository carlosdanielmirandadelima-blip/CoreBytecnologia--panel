import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertInsideBackupDir } from "@/lib/backup";
import { writeAudit } from "@/lib/audit";

/**
 * Baixa um arquivo de backup.
 * Exige sessão e confina o caminho ao diretório de backups.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const backup = await prisma.backup.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });

  let filePath: string;
  try {
    filePath = assertInsideBackupDir(backup.filePath);
  } catch {
    return NextResponse.json({ error: "Caminho de backup inválido" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "O arquivo não está mais no disco" }, { status: 404 });
  }

  await writeAudit(req, {
    action: "backup.download",
    resource: "backup",
    resourceId: backup.id,
    details: `Download do backup "${backup.fileName}"`,
    user,
  });

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
