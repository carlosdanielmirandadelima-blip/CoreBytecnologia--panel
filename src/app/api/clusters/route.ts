import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clusters = await prisma.cluster.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(clusters);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, endpoint, token } = body;

    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const cluster = await prisma.cluster.create({
      data: {
        name,
        type: type || "k3s",
        endpoint: endpoint || "",
        token: token || "",
      },
    });

    return NextResponse.json(cluster, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar cluster" }, { status: 500 });
  }
}
