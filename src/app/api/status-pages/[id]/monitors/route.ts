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
    const { name, type, target, interval, timeout } = body;

    if (!name || !target) {
      return NextResponse.json({ error: "Nome e target são obrigatórios" }, { status: 400 });
    }

    const monitor = await prisma.statusMonitor.create({
      data: {
        name,
        type: type || "http",
        target,
        interval: interval || 60,
        timeout: timeout || 10,
        pageId: params.id,
      },
    });

    return NextResponse.json(monitor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar monitor" }, { status: 500 });
  }
}
