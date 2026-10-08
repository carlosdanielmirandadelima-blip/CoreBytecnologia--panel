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
 * Edita, reordena e remove um serviço específico do projeto.
 */

async function loadService(projectId: string, serviceId: string, user: { id: string; role?: string | null }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: { orderBy: { position: "asc" } } },
  });
  if (!project) return { error: NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 }) };

  const denied = await assertTeamAccess(user, project.teamId);
  if (denied) return { error: denied };

  const service = project.services.find((s) => s.id === serviceId);
  if (!service) return { error: NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 }) };

  return { project, service };
}

/** PATCH — atualiza o serviço (nome, imagem, portas, volumes, domínio…). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; serviceId: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const loaded = await loadService(params.id, params.serviceId, user!);
  if (loaded.error) return loaded.error;
  const { project, service } = loaded;

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
      position?: number;
    };

    const data: Record<string, unknown> = {};

    if (body.name !== undefined && body.name !== service!.name) {
      const name = assertName(body.name, "nome do serviço");
      const clash = project!.services.some((s) => s.id !== service!.id && s.name === name);
      if (clash) return NextResponse.json({ error: `Já existe um serviço "${name}".` }, { status: 400 });
      data.name = name;
    }

    if (body.image !== undefined) data.image = assertString(body.image, "imagem", 300, true);

    if (body.ports !== undefined) {
      const ports = Array.isArray(body.ports)
        ? body.ports.map((p) => normalizePortMapping(p)).filter(Boolean)
        : typeof body.ports === "string" && body.ports.trim()
        ? body.ports.split(",").filter(Boolean).map((p) => normalizePortMapping(p.trim()))
        : [];
      data.ports = ports.join(",");
      // Ao trocar as portas, liga a exposição se o projeto tiver domínio.
      if (ports.length && body.expose === undefined) data.expose = true;
    }

    if (body.volumes !== undefined) {
      const volumes = Array.isArray(body.volumes)
        ? body.volumes.map((v) => normalizeVolumeMapping(v)).filter(Boolean)
        : typeof body.volumes === "string" && body.volumes.trim()
        ? body.volumes.split(",").filter(Boolean).map((v) => normalizeVolumeMapping(v.trim()))
        : [];
      data.volumes = volumes.join(",");
    }

    if (body.command !== undefined) data.command = assertString(body.command, "comando", 1000);
    if (body.domain !== undefined) data.domain = assertDomain(body.domain);
    if (body.expose !== undefined) data.expose = Boolean(body.expose);
    if (body.note !== undefined) data.note = assertString(body.note, "observação", 300);
    if (body.position !== undefined && Number.isInteger(body.position)) data.position = body.position;

    if (body.envVars !== undefined) {
      const envVars = body.envVars
        .filter((e) => e && e.key)
        .map((e) => ({
          key: assertString(e.key, "chave da variável", 200, true),
          value: String(e.value ?? "").slice(0, 8000),
        }));
      data.envVars = JSON.stringify(envVars);
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const updated = await prisma.service.update({ where: { id: service!.id }, data });

    await writeAudit(req, {
      action: "service.update",
      resource: "service",
      resourceId: service!.id,
      details: `Serviço "${updated.name}" atualizado no projeto "${project!.name}"`,
      user,
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : "Erro ao atualizar serviço";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE — remove o serviço (e o container dele). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string; serviceId: string } }) {
  const { user, error } = await requireSession();
  if (error) return error;

  const loaded = await loadService(params.id, params.serviceId, user!);
  if (loaded.error) return loaded.error;
  const { project, service } = loaded;

  // Para e remove o container antes de apagar o registro.
  if (service!.containerId) {
    try {
      const { removeContainer } = await import("@/lib/docker");
      await removeContainer(service!.containerId, true);
    } catch {
      // container já não existe
    }
  }

  await prisma.service.delete({ where: { id: service!.id } });

  await writeAudit(req, {
    action: "service.delete",
    resource: "service",
    resourceId: service!.id,
    details: `Serviço "${service!.name}" removido do projeto "${project!.name}"`,
    user,
  });

  return NextResponse.json({ ok: true });
}
