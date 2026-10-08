import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, assertTeamAccess } from "@/lib/session";
import {
  assertName,
  assertString,
  assertDomain,
  normalizePortMapping,
  normalizeVolumeMapping,
  ValidationError,
} from "@/lib/validate";
import { writeAudit } from "@/lib/audit";

/**
 * Serviços de um projeto.
 *
 * Um projeto pode conter VÁRIOS serviços (app, banco, cache…), cada um com
 * imagem, portas, volumes e domínio próprios — como no Easypanel.
 */

/** Confere se o usuário pode mexer no projeto. */
async function loadProject(projectId: string, user: { id: string; role?: string | null }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: { orderBy: { position: "asc" } } },
  });
  if (!project) return { error: NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 }) };

  const denied = await assertTeamAccess(user, project.teamId);
  if (denied) return { error: denied };

  return { project };
}

/** GET /api/projects/[id]/services — lista os serviços do projeto. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const loaded = await loadProject(params.id, user!);
  if (loaded.error) return loaded.error;

  return NextResponse.json(loaded.project.services);
}

/** POST /api/projects/[id]/services — adiciona um serviço. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const loaded = await loadProject(params.id, user!);
  if (loaded.error) return loaded.error;
  const project = loaded.project!;

  try {
    const body = (await req.json()) as {
      name?: string;
      image?: string;
      ports?: unknown;
      volumes?: unknown;
      command?: string;
      domain?: string;
      expose?: boolean;
      note?: string;
      envVars?: { key?: string; value?: string }[];
    };

    const image = assertString(body.image, "imagem", 300, true);
    // Nome padrão vem da própria imagem (ex.: "postgres:16" -> "postgres").
    const defaultName = (image.split(":")[0].split("/").pop() || "app").replace(/[^a-zA-Z0-9_.-]/g, "-");
    const name = body.name ? assertName(body.name, "nome do serviço") : assertName(defaultName, "nome do serviço");

    // Nome único dentro do projeto.
    const exists = project.services.some((s) => s.name === name);
    if (exists) {
      return NextResponse.json(
        { error: `Já existe um serviço chamado "${name}" neste projeto.` },
        { status: 400 }
      );
    }

    const ports = Array.isArray(body.ports)
      ? body.ports.map((p) => normalizePortMapping(p)).filter(Boolean)
      : typeof body.ports === "string" && body.ports.trim()
      ? body.ports.split(",").filter(Boolean).map((p) => normalizePortMapping(p.trim()))
      : [];

    const volumes = Array.isArray(body.volumes)
      ? body.volumes.map((v) => normalizeVolumeMapping(v)).filter(Boolean)
      : typeof body.volumes === "string" && body.volumes.trim()
      ? body.volumes.split(",").filter(Boolean).map((v) => normalizeVolumeMapping(v.trim()))
      : [];

    const envVars = (body.envVars ?? [])
      .filter((e) => e && e.key)
      .map((e) => ({
        key: assertString(e.key, "chave da variável", 200, true),
        value: String(e.value ?? "").slice(0, 8000),
      }));

    const nextPosition = project.services.reduce((max, s) => Math.max(max, s.position), -1) + 1;

    const service = await prisma.service.create({
      data: {
        projectId: project.id,
        name,
        image,
        ports: ports.join(","),
        volumes: volumes.join(","),
        command: body.command ? assertString(body.command, "comando", 1000) : "",
        domain: assertDomain(body.domain),
        // Por padrão publica se tiver porta e o projeto tiver domínio.
        expose: body.expose ?? Boolean(project.domain && ports.length),
        note: body.note ? assertString(body.note, "observação", 300) : "",
        envVars: JSON.stringify(envVars),
        position: nextPosition,
      },
    });

    await writeAudit(req, {
      action: "service.create",
      resource: "service",
      resourceId: service.id,
      details: `Serviço "${name}" (${image}) adicionado ao projeto "${project.name}"`,
      user,
    });

    return NextResponse.json(service, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : "Erro ao adicionar serviço";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
