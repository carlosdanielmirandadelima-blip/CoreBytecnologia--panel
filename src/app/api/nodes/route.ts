import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nodes = await prisma.node.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(nodes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, host, port, protocol, isLocal } = body;

    if (!name || !host) {
      return NextResponse.json({ error: "Nome e host são obrigatórios" }, { status: 400 });
    }

    const node = await prisma.node.create({
      data: {
        name,
        host,
        port: port || 2375,
        protocol: protocol || "http",
        isLocal: isLocal || false,
        status: "checking",
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao adicionar servidor" }, { status: 500 });
  }
}
