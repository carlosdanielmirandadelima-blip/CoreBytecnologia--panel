import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decryptConfig } from "@/lib/crypto";
import { createAdapter, describeError } from "@/lib/storage";
import { resolveType } from "@/lib/storage/providers";
import { writeAudit } from "@/lib/audit";
import { encryptConfig, decryptConfig as decrypt } from "@/lib/crypto";
import { findProviderDef } from "@/lib/storage/providers";
import { assertString, isBlank } from "@/lib/validate";

/**
 * Lista, testa, atualiza e remove um provedor de nuvem.
 * Tudo exige sessão (antes o PATCH/DELETE eram públicos).
 */

function buildAdapter(provider: { type: string; config: string; folder: string | null }) {
  const type = resolveType(provider.type);
  if (!type) throw new Error(`Tipo de armazenamento não suportado: ${provider.type}`);
  return createAdapter(type, decryptConfig(provider.config), provider.folder || undefined, provider.type);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession();
  if (error) return error;

  const provider = await prisma.cloudProvider.findUnique({ where: { id: params.id } });
  if (!provider) return NextResponse.json({ error: "Provedor não encontrado" }, { status: 404 });

  try {
    const adapter = buildAdapter(provider);
    if (!adapter.list) {
      return NextResponse.json({ files: [], note: "Este serviço não permite listar arquivos remotamente." });
    }
    const files = await adapter.list();
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: describeError(e) }, { status: 400 });
  }
}

/** POST — testa a conexão de um provedor já salvo. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const provider = await prisma.cloudProvider.findUnique({ where: { id: params.id } });
  if (!provider) return NextResponse.json({ error: "Provedor não encontrado" }, { status: 404 });

  try {
    const adapter = buildAdapter(provider);
    const message = await adapter.test();
    await prisma.cloudProvider.update({ where: { id: provider.id }, data: { lastError: "" } });
    await writeAudit(_req, {
      action: "cloud-provider.test",
      resource: "cloud-provider",
      resourceId: provider.id,
      details: `Teste de conexão bem-sucedido em "${provider.name}"`,
      user,
    });
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    const message = describeError(e);
    await prisma.cloudProvider.update({
      where: { id: provider.id },
      data: { lastError: message.slice(0, 500) },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/** PATCH — atualiza dados e credenciais (recifrando o que mudou). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const provider = await prisma.cloudProvider.findUnique({ where: { id: params.id } });
  if (!provider) return NextResponse.json({ error: "Provedor não encontrado" }, { status: 404 });

  try {
    const body = (await req.json()) as {
      name?: string;
      config?: Record<string, unknown>;
      folder?: string;
      enabled?: boolean;
      autoBackup?: boolean;
      autoFrequency?: string;
    };

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = assertString(body.name, "nome", 120, true);
    if (body.folder !== undefined) data.folder = assertString(body.folder, "pasta", 500);
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
    if (body.autoBackup !== undefined) data.autoBackup = Boolean(body.autoBackup);
    if (body.autoFrequency !== undefined) {
      data.autoFrequency = ["daily", "weekly", "monthly"].includes(String(body.autoFrequency))
        ? String(body.autoFrequency)
        : "daily";
    }

    // Credenciais: preserva as existentes e só sobrescreve o que foi informado.
    if (body.config) {
      const existing = decrypt(provider.config);
      const def = findProviderDef(provider.type);
      const merged: Record<string, string> = { ...existing };
      for (const [k, v] of Object.entries(body.config)) {
        if (isBlank(v)) continue; // campo em branco = manter o atual
        merged[k] = String(v).slice(0, 20000);
      }
      for (const [k, v] of Object.entries(def?.defaults ?? {})) {
        if (!merged[k] && !k.endsWith("Template")) merged[k] = String(v);
      }
      data.config = encryptConfig(merged);
    }

    const updated = await prisma.cloudProvider.update({ where: { id: provider.id }, data });

    await writeAudit(req, {
      action: "cloud-provider.update",
      resource: "cloud-provider",
      resourceId: provider.id,
      details: `Provedor de nuvem "${updated.name}" atualizado`,
      user,
    });

    return NextResponse.json({ id: updated.id, name: updated.name });
  } catch (e) {
    return NextResponse.json({ error: describeError(e) }, { status: 400 });
  }
}

/** DELETE — remove o provedor. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const provider = await prisma.cloudProvider.findUnique({ where: { id: params.id } });
  if (!provider) return NextResponse.json({ error: "Provedor não encontrado" }, { status: 404 });

  await prisma.cloudProvider.delete({ where: { id: provider.id } });

  await writeAudit(req, {
    action: "cloud-provider.delete",
    resource: "cloud-provider",
    resourceId: provider.id,
    details: `Provedor de nuvem "${provider.name}" removido`,
    user,
  });

  return NextResponse.json({ ok: true });
}
