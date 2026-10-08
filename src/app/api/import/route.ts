import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/**
 * Importação de configuração (arquivo gerado pela exportação).
 *
 * Bugs corrigidos:
 *  - a versão anterior usava `prisma.variable`, model que não existe no
 *    schema — a importação falhava com 500 mesmo em arquivos válidos;
 *  - não validava o formato dos itens antes de gravar no banco;
 *  - não era restrita ao administrador.
 *
 * A importação é aditiva: nada é apagado. Registros existentes (mesmo id)
 * são atualizados.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      panel?: string;
      data?: Record<string, unknown[]>;
    };

    if (!body?.data || (body.panel !== "CoreByte Panel" && body.panel !== undefined)) {
      return NextResponse.json(
        { error: "Arquivo inválido: use um arquivo gerado pela exportação do CoreByte Panel." },
        { status: 400 }
      );
    }

    const data = body.data;
    const results: Record<string, number> = {};

    // --- Variáveis de ambiente globais ---
    if (Array.isArray(data.globalEnvVars) && data.globalEnvVars.length) {
      let count = 0;
      for (const raw of data.globalEnvVars as Record<string, unknown>[]) {
        const key = String(raw.key ?? "").trim();
        if (!key) continue;
        await prisma.globalEnvVar.upsert({
          where: { key },
          create: {
            key,
            value: String(raw.value ?? ""),
            description: String(raw.description ?? ""),
          },
          update: {
            value: String(raw.value ?? ""),
            description: String(raw.description ?? ""),
          },
        });
        count++;
      }
      results.globalEnvVars = count;
    }

    // --- Dynamic DNS ---
    if (Array.isArray(data.dynamicDns) && data.dynamicDns.length) {
      let count = 0;
      for (const raw of data.dynamicDns as Record<string, unknown>[]) {
        const hostname = String(raw.hostname ?? "").trim();
        if (!hostname) continue;
        const id = typeof raw.id === "string" ? raw.id : undefined;
        const payload = {
          hostname,
          type: String(raw.type ?? "A"),
          provider: String(raw.provider ?? "cloudflare"),
          zoneId: String(raw.zoneId ?? ""),
          recordId: String(raw.recordId ?? ""),
          token: String(raw.token ?? ""),
          interval: Number(raw.interval) > 0 ? Number(raw.interval) : 300,
          enabled: raw.enabled !== false,
        };
        if (id) {
          await prisma.dynamicDns.upsert({ where: { id }, create: { id, ...payload }, update: payload });
        } else {
          await prisma.dynamicDns.create({ data: payload });
        }
        count++;
      }
      results.dynamicDns = count;
    }

    // --- Shortcuts ---
    if (Array.isArray(data.shortcuts) && data.shortcuts.length) {
      let count = 0;
      for (const raw of data.shortcuts as Record<string, unknown>[]) {
        const action = String(raw.action ?? "").trim();
        if (!action) continue;
        const existing = await prisma.shortcut.findFirst({ where: { action } });
        const payload = {
          key: String(raw.key ?? ""),
          action,
          label: String(raw.label ?? action),
          enabled: raw.enabled !== false,
        };
        if (existing) {
          await prisma.shortcut.update({ where: { id: existing.id }, data: payload });
        } else {
          await prisma.shortcut.create({ data: payload });
        }
        count++;
      }
      results.shortcuts = count;
    }

    await writeAudit(req, {
      action: "panel.import",
      resource: "panel",
      details: `Importação concluída: ${Object.entries(results)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ") || "nada a importar"}`,
      user,
    });

    return NextResponse.json({ success: true, imported: results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao importar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
