import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pages = await prisma.statusPage.findMany({
    orderBy: { createdAt: "desc" },
    include: { monitors: true },
  });

  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, slug, description, isPublic } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
    }

    const existing = await prisma.statusPage.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Slug já existe" }, { status: 400 });

    const page = await prisma.statusPage.create({
      data: { name, slug, description: description || "", isPublic: isPublic ?? true },
    });

    return NextResponse.json(page, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar status page" }, { status: 500 });
  }
}
