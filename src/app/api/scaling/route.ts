import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const where = projectId ? { projectId } : {};

  const rules = await prisma.scalingRule.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, projectId, metric, threshold, minReplicas, maxReplicas, cooldown } = body;

    if (!name || !projectId) return NextResponse.json({ error: "Nome e projeto são obrigatórios" }, { status: 400 });

    const rule = await prisma.scalingRule.create({
      data: {
        name,
        projectId,
        metric: metric || "cpu",
        threshold: threshold || 80,
        minReplicas: minReplicas || 1,
        maxReplicas: maxReplicas || 5,
        cooldown: cooldown || 60,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar regra" }, { status: 500 });
  }
}
