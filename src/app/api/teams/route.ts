import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const teams = await prisma.team.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(teams);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, description } = body;

  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: session.user?.email ?? "" } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const team = await prisma.team.create({
    data: {
      name,
      description: description || "",
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });

  return NextResponse.json(team, { status: 201 });
}
