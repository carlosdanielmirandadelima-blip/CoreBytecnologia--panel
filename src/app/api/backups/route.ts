import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { runBackup, listBackupFiles, assertInsideBackupDir } from "@/lib/backup";
import { ensurePanelNetwork } from "@/lib/docker";
import { assertBackupSource, assertString, ValidationError } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";

/**
 * Lista e cria backups.
 *
 * Antes esta rota montava comandos de shell interpolando o campo `source`
 * (injeção de comando) e usava o binário `docker`, que não existe na imagem.
 */

const BACKUP_TYPES = ["volume", "container", "file"];

/** GET /api/backups */
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const onDisk = await listBackupFiles();

  return NextResponse.json(
    backups.map((b) => ({
      ...b,
      existsOnDisk: b.filePath ? onDisk.has(b.fileName) : false,
      diskSize: onDisk.get(b.fileName) ?? null,
    }))
  );
}

/** POST /api/backups — inicia um backup sob demanda. */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      source?: string;
      scheduleId?: string;
    };

    const type = BACKUP_TYPES.includes(String(body.type)) ? String(body.type) : "volume";
    const name = assertString(body.name, "nome", 120, true);
    // Allow-list de formato: é isto que impede a injeção de comando.
    const source = assertBackupSource(body.source, type);

    await ensurePanelNetwork();

    const result = await runBackup({ name, type, source });

    await writeAudit(req, {
      action: "backup.create",
      resource: "backup",
      resourceId: result.id,
      details: `Backup "${name}" (${type}: ${source}) concluído`,
      user,
    });

    return NextResponse.json(
      {
        id: result.id,
        status: result.status,
        fileName: result.fileName,
        fileSize: result.size,
        message: "Backup concluído",
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao criar backup";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/backups — limpa todos os registros e arquivos órfãos. */
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  const backups = await prisma.backup.findMany();
  let removed = 0;
  for (const b of backups) {
    try {
      if (b.filePath && fs.existsSync(assertInsideBackupDir(b.filePath))) {
        fs.unlinkSync(assertInsideBackupDir(b.filePath));
      }
    } catch {
      // arquivo já removido
    }
    await prisma.backup.delete({ where: { id: b.id } });
    removed++;
  }

  await writeAudit(req, {
    action: "backup.clear",
    resource: "backup",
    details: `${removed} backup(s) removido(s)`,
    user,
  });

  return NextResponse.json({ ok: true, removed });
}

