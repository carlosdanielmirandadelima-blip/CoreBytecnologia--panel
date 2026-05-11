import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, permissions: true, lastUsed: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, permissions, expiresInDays } = body;

    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const userId = (session.user as { id: string }).id;
    const rawKey = `cb_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = rawKey.substring(0, 10) + "...";

    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key: rawKey,
        prefix,
        permissions: permissions || "read",
        expiresAt,
        userId,
      },
    });

    return NextResponse.json({ ...apiKey, fullKey: rawKey }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar API key" }, { status: 500 });
  }
}
