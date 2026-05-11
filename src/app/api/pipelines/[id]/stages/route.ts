import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, command } = body;

    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const existingStages = await prisma.pipelineStage.count({ where: { pipelineId: params.id } });

    const stage = await prisma.pipelineStage.create({
      data: {
        name,
        type: type || "build",
        command: command || "",
        order: existingStages,
        pipelineId: params.id,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar estágio" }, { status: 500 });
  }
}
