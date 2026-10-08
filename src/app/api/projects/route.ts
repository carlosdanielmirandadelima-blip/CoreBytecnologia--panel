import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, assertTeamAccess } from "@/lib/session";
import { createProjectFromTemplate, createProjectWithServices } from "@/lib/deploy";
import {
  assertDomain,
  assertName,
  assertString,
  normalizePortMapping,
  normalizeVolumeMapping,
  ValidationError,
} from "@/lib/validate";
import { writeAudit } from "@/lib/audit";

/**
 * Projetos.
 *
 * O Marketplace enviava `image`, `ports` e `volumes` na raiz do JSON, mas a
 * API esperava `services[]` — resultado: o "deploy com 1 clique" criava um
 * projeto VAZIO (0 serviços) e mostrava "sucesso". Agora a rota aceita os
 * dois formatos e converte para a forma canônica.
 */

export async function GET() {
  const { user, error } = await requireSession();
  if (error) return error;

  const projects = await prisma.project.findMany({
    include: { services: true, envVars: true },
    orderBy: { createdAt: "desc" },
  });

  // Um administrador vê tudo; os demais veem apenas os projetos sem dono
  // ou dos times a que pertencem.
  if (user!.role === "admin") return NextResponse.json(projects);

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user!.id },
    select: { teamId: true },
  });
  const teamIds = new Set(memberships.map((m) => m.teamId));

  return NextResponse.json(
    projects.filter((p) => !p.teamId || teamIds.has(p.teamId))
  );
}

interface IncomingService {
  name?: string;
  image?: string;
  ports?: unknown;
  volumes?: unknown;
  command?: string;
}

/** Converte portas/volumes (string ou objeto) para o formato canônico. */
function normalizeService(s: IncomingService, index: number) {
  const image = assertString(s.image, "imagem", 300, true);
  const name = s.name
    ? assertName(s.name, "nome do serviço")
    : assertName(
        (image.split(":")[0].split("/").pop() || `app${index + 1}`).replace(/[^a-zA-Z0-9_.-]/g, "-"),
        "nome do serviço"
      );

  const ports = Array.isArray(s.ports)
    ? s.ports.map((p) => normalizePortMapping(p)).filter(Boolean)
    : typeof s.ports === "string" && s.ports.trim()
    ? s.ports.split(",").filter(Boolean).map((p) => normalizePortMapping(p.trim()))
    : [];

  const volumes = Array.isArray(s.volumes)
    ? s.volumes.map((v) => normalizeVolumeMapping(v)).filter(Boolean)
    : typeof s.volumes === "string" && s.volumes.trim()
    ? s.volumes.split(",").filter(Boolean).map((v) => normalizeVolumeMapping(v.trim()))
    : [];

  return {
    name,
    image,
    ports: ports.join(","),
    volumes: volumes.join(","),
    command: s.command ? assertString(s.command, "comando", 1000) : "",
  };
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      templateId?: string;
      description?: string;
      domain?: string;
      teamId?: string;
      gitUrl?: string;
      branch?: string;
      composeFile?: string;
      envVars?: { key?: string; value?: string }[];
      services?: IncomingService[];
      // Formato enviado pelo Marketplace (imagem única na raiz):
      image?: string;
      ports?: unknown;
      volumes?: unknown;
    };

    const name = assertName(body.name, "nome do projeto");
    const domain = assertDomain(body.domain);
    const teamId = body.teamId ? assertString(body.teamId, "teamId", 60) : "";

    if (teamId) {
      const denied = await assertTeamAccess(user!, teamId);
      if (denied) return denied;
    }

    const envVars = (body.envVars ?? [])
      .filter((e) => e && e.key)
      .map((e) => ({
        key: assertString(e.key, "chave da variável", 200, true),
        value: String(e.value ?? "").slice(0, 8000),
      }));

    // 1) Template do catálogo interno (caminho correto e completo).
    if (body.type === "template" && body.templateId) {
      const project = await createProjectFromTemplate(name, body.templateId, Object.fromEntries(envVars.map((e) => [e.key, e.value])), {
        domain,
        teamId,
      });
      await writeAudit(req, {
        action: "project.create",
        resource: "project",
        resourceId: project.id,
        details: `Projeto "${name}" criado a partir do template "${body.templateId}"`,
        user,
      });
      return NextResponse.json(project, { status: 201 });
    }

    // 2) Lista de serviços explícita.
    let services = (body.services ?? []).map((s, i) => normalizeService(s, i));

    // 3) Formato do Marketplace: uma imagem na raiz com portas/volumes.
    if (!services.length && body.image) {
      services = [normalizeService({ image: body.image, ports: body.ports, volumes: body.volumes }, 0)];
    }

    if (!services.length) {
      return NextResponse.json(
        {
          error:
            "Nenhum serviço informado. Envie `services[]`, ou `templateId` (template), ou `image` com `ports`/`volumes`.",
        },
        { status: 400 }
      );
    }

    const project = await createProjectWithServices(name, services, {
      description: body.description ? assertString(body.description, "descrição", 1000) : "",
      type: body.type || "custom",
      domain,
      teamId: body.teamId ? teamId : undefined,
      envVars,
    });

    await writeAudit(req, {
      action: "project.create",
      resource: "project",
      resourceId: project.id,
      details: `Projeto "${name}" criado com ${services.length} serviço(s): ${services.map((s) => s.image).join(", ")}`,
      user,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao criar o projeto";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
