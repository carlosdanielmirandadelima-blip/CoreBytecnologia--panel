import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });

  if (!team) return NextResponse.json({ error: "Time não encontrado" }, { status: 404 });
  return NextResponse.json(team);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, description } = body;

  const team = await prisma.team.update({
    where: { id: params.id },
    data: { name, description },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });

  return NextResponse.json(team);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await prisma.team.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
