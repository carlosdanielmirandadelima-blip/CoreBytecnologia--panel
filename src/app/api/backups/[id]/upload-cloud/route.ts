import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decryptConfig } from "@/lib/crypto";
import { createAdapter, describeError } from "@/lib/storage";
import { resolveType } from "@/lib/storage/providers";
import { assertInsideBackupDir } from "@/lib/backup";
import { writeAudit } from "@/lib/audit";

/**
 * Envia um backup para a nuvem.
 *
 * Antes: rota pública (qualquer pessoa podia mandar os backups de um
 * cliente para uma conta escolhida por ela) e usando apenas Dropbox/Google
 * Drive com tokens fixos, sem validação.
 * Agora: exige sessão, cifra credenciais e usa os adaptadores com multipart.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json().catch(() => ({}))) as { providerId?: string };
    const providerId = String(body.providerId || "");
    if (!providerId) {
      return NextResponse.json({ error: "Informe o provedor de nuvem (providerId)" }, { status: 400 });
    }

    const backup = await prisma.backup.findUnique({ where: { id: params.id } });
    if (!backup) return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });
    if (backup.status !== "completed") {
      return NextResponse.json({ error: "O backup ainda não foi concluído" }, { status: 400 });
    }

    const filePath = assertInsideBackupDir(backup.filePath);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "O arquivo de backup não está mais no disco" }, { status: 404 });
    }

    const provider = await prisma.cloudProvider.findUnique({ where: { id: providerId } });
    if (!provider) return NextResponse.json({ error: "Provedor de nuvem não encontrado" }, { status: 404 });
    if (!provider.enabled) {
      return NextResponse.json({ error: "Este provedor está desativado" }, { status: 400 });
    }

    const type = resolveType(provider.type);
    if (!type) {
      return NextResponse.json({ error: `Tipo de armazenamento não suportado: ${provider.type}` }, { status: 400 });
    }

    const config = decryptConfig(provider.config);
    const adapter = createAdapter(type, config, provider.folder || undefined, provider.type);

    const remotePath = await adapter.upload(filePath, backup.fileName);

    await prisma.backup.update({
      where: { id: backup.id },
      data: {
        cloudProviderId: provider.id,
        remotePath,
        uploadedAt: new Date(),
      },
    });
    await prisma.cloudProvider.update({
      where: { id: provider.id },
      data: { lastSync: new Date(), lastError: "" },
    });

    await writeAudit(req, {
      action: "backup.upload-cloud",
      resource: "backup",
      resourceId: backup.id,
      details: `Backup "${backup.fileName}" enviado para ${provider.name}`,
      user,
    });

    return NextResponse.json({
      ok: true,
      message: `Backup enviado para ${provider.name}`,
      remotePath,
    });
  } catch (e) {
    const message = describeError(e);
    // Registra a falha no provedor para aparecer na interface.
    try {
      const body = (await req.clone().json()) as { providerId?: string };
      if (body?.providerId) {
        await prisma.cloudProvider.update({
          where: { id: body.providerId },
          data: { lastError: message.slice(0, 500) },
        });
      }
    } catch {
      // ignora
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
