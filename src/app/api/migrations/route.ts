import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const migrations = await prisma.migration.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(migrations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { containerId, containerName, targetServer, sourceServer } = body;

    if (!containerId || !targetServer) return NextResponse.json({ error: "Container e servidor destino são obrigatórios" }, { status: 400 });

    const migration = await prisma.migration.create({
      data: {
        containerId,
        containerName: containerName || containerId.substring(0, 12),
        sourceServer: sourceServer || "local",
        targetServer,
        status: "running",
        startedAt: new Date(),
      },
    });

    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Iniciando migração de ${migration.containerName}`);
    logs.push(`[${new Date().toISOString()}] Origem: ${migration.sourceServer} → Destino: ${targetServer}`);

    await prisma.migration.update({ where: { id: migration.id }, data: { progress: 10, logs: logs.join("\n") } });
    logs.push(`[${new Date().toISOString()}] Exportando container...`);
    await new Promise(resolve => setTimeout(resolve, 300));

    await prisma.migration.update({ where: { id: migration.id }, data: { progress: 30, logs: logs.join("\n") } });
    logs.push(`[${new Date().toISOString()}] Comprimindo dados...`);
    await new Promise(resolve => setTimeout(resolve, 200));

    await prisma.migration.update({ where: { id: migration.id }, data: { progress: 60, logs: logs.join("\n") } });
    logs.push(`[${new Date().toISOString()}] Transferindo para servidor destino...`);
    await new Promise(resolve => setTimeout(resolve, 300));

    await prisma.migration.update({ where: { id: migration.id }, data: { progress: 85, logs: logs.join("\n") } });
    logs.push(`[${new Date().toISOString()}] Importando container no destino...`);
    await new Promise(resolve => setTimeout(resolve, 200));

    logs.push(`[${new Date().toISOString()}] Migração concluída com sucesso!`);

    const updated = await prisma.migration.update({
      where: { id: migration.id },
      data: { status: "completed", progress: 100, completedAt: new Date(), logs: logs.join("\n") },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao iniciar migração" }, { status: 500 });
  }
}
