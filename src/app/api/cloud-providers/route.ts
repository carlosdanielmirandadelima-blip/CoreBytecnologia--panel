import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { findProviderDef, STORAGE_PROVIDERS, buildEndpoint, PROVIDER_GROUPS } from "@/lib/storage/providers";
import { encryptConfig, decryptConfig, maskValue } from "@/lib/crypto";
import { createAdapter, describeError } from "@/lib/storage";
import { assertString, assertUrl, isBlank } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";

/**
 * Provedores de armazenamento em nuvem.
 *
 * Antes esta rota não exigia autenticação: qualquer pessoa podia ler e
 * criar credenciais de nuvem (e depois usá-las para exfiltrar backups).
 */

/** GET /api/cloud-providers — lista sem revelar credenciais. */
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const providers = await prisma.cloudProvider.findMany({ orderBy: { createdAt: "desc" } });

  // Nunca devolve valores de credencial; apenas a máscara e o que já é público.
  const safe = providers.map((p) => {
    const cfg = decryptConfig(p.config);
    const def = findProviderDef(p.type) ?? findProviderDef(p.authType);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      typeName: def?.name ?? p.type,
      authType: p.authType,
      folder: p.folder,
      enabled: p.enabled,
      autoBackup: p.autoBackup,
      autoFrequency: p.autoFrequency,
      lastSync: p.lastSync,
      lastError: p.lastError,
      createdAt: p.createdAt,
      // Campos mascarados (o cliente só mostra "•••• 1234").
      hasCredentials: Object.keys(cfg).length > 0,
      maskedKeys: Object.fromEntries(
        Object.entries(cfg)
          .filter(([k]) => !["region", "endpoint", "forcePathStyle", "port", "secure", "folder", "bucket", "prefix", "folderId"].includes(k))
          .map(([k, v]) => [k, maskValue(v)])
      ),
    };
  });

  return NextResponse.json({ providers: safe, catalog: STORAGE_PROVIDERS, groups: PROVIDER_GROUPS });
}

/**
 * POST /api/cloud-providers — cria um provedor.
 * As credenciais são cifradas antes de ir para o banco.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      config?: Record<string, unknown>;
      folder?: string;
      autoBackup?: boolean;
      autoFrequency?: string;
      authType?: string;
    };

    const name = assertString(body.name, "nome", 120, true);
    const type = assertString(body.type, "tipo", 60, true);
    const def = findProviderDef(type);
    if (!def) {
      return NextResponse.json(
        { error: `Serviço de nuvem desconhecido: ${type}` },
        { status: 400 }
      );
    }

    // Valida os campos obrigatórios definidos no catálogo.
    const rawConfig = (body.config ?? {}) as Record<string, unknown>;
    const config: Record<string, string> = {};
    for (const field of def.fields) {
      const value = rawConfig[field.key];
      if (isBlank(value)) {
        if (field.required) {
          return NextResponse.json({ error: `O campo "${field.label}" é obrigatório.` }, { status: 400 });
        }
        continue;
      }
      if (field.type === "url") {
        config[field.key] = assertUrl(value, field.label);
      } else {
        config[field.key] = String(value).slice(0, 20000);
      }
    }

    // Aplica padrões do catálogo (ex.: path-style, região).
    for (const [k, v] of Object.entries(def.defaults ?? {})) {
      if (!config[k] && !k.endsWith("Template")) config[k] = String(v);
    }

    const folder = body.folder !== undefined ? assertString(body.folder, "pasta", 500) : def.fields.find((f) => f.key === "folder")?.default || "";

    const provider = await prisma.cloudProvider.create({
      data: {
        name,
        type,
        authType: def.authType,
        config: encryptConfig(config),
        folder,
        autoBackup: Boolean(body.autoBackup),
        autoFrequency: ["daily", "weekly", "monthly"].includes(String(body.autoFrequency))
          ? String(body.autoFrequency)
          : "daily",
      },
    });

    await writeAudit(req, {
      action: "cloud-provider.create",
      resource: "cloud-provider",
      resourceId: provider.id,
      details: `Provedor de nuvem "${name}" (${def.name}) criado`,
      user,
    });

    return NextResponse.json(
      { id: provider.id, name: provider.name, type: provider.type },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: describeError(e) }, { status: 400 });
  }
}

/**
 * PUT /api/cloud-providers — testa as credenciais informadas (sem gravar).
 * Usado pelo botão "Testar conexão" do formulário.
 */
export async function PUT(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      type?: string;
      config?: Record<string, unknown>;
      folder?: string;
    };
    const type = assertString(body.type, "tipo", 60, true);
    const def = findProviderDef(type);
    if (!def) return NextResponse.json({ error: "Serviço de nuvem desconhecido" }, { status: 400 });

    const config: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.config ?? {})) {
      if (!isBlank(v)) config[k] = String(v);
    }
    for (const [k, v] of Object.entries(def.defaults ?? {})) {
      if (!config[k] && !k.endsWith("Template")) config[k] = String(v);
    }
    // O endpoint pode ser montado a partir da região.
    if (!config.endpoint) {
      const built = buildEndpoint(type, config);
      if (built) config.endpoint = built;
    }

    const adapter = createAdapter(def.type, config, body.folder || config.folder, type);
    const message = await adapter.test();
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    return NextResponse.json({ ok: false, error: describeError(e) }, { status: 400 });
  }
}
