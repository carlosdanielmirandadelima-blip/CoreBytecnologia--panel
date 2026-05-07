import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelines = await prisma.pipeline.findMany({
    orderBy: { createdAt: "desc" },
    include: { stages: { orderBy: { order: "asc" } }, runs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return NextResponse.json(pipelines);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, projectId, trigger, stages } = body;

    if (!name || !projectId) return NextResponse.json({ error: "Nome e projeto são obrigatórios" }, { status: 400 });

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        projectId,
        trigger: trigger || "manual",
        stages: stages?.length ? {
          create: stages.map((s: { name: string; type: string; command: string }, i: number) => ({
            name: s.name,
            type: s.type || "build",
            command: s.command || "",
            order: i,
          })),
        } : undefined,
      },
      include: { stages: true },
    });

    return NextResponse.json(pipeline, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar pipeline" }, { status: 500 });
  }
}
