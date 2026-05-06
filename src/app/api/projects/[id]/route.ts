import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeProject, syncProjectStatus } from "@/lib/deploy";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const project = await syncProjectStatus(params.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  return NextResponse.json(project);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, description, domain, envVars } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (domain !== undefined) updateData.domain = domain;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
    include: { services: true, envVars: true },
  });

  if (envVars && Array.isArray(envVars)) {
    await prisma.envVar.deleteMany({ where: { projectId: params.id } });
    for (const ev of envVars) {
      await prisma.envVar.create({
        data: { key: ev.key, value: ev.value, projectId: params.id },
      });
    }
  }

  const updated = await prisma.project.findUnique({
    where: { id: params.id },
    include: { services: true, envVars: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    await removeProject(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao remover projeto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
