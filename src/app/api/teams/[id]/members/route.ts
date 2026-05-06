import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { email, role } = body;

  if (!email) return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado com esse email" }, { status: 404 });

  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: params.id } },
  });
  if (existing) return NextResponse.json({ error: "Usuário já é membro deste time" }, { status: 400 });

  const member = await prisma.teamMember.create({
    data: {
      userId: user.id,
      teamId: params.id,
      role: role || "member",
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) return NextResponse.json({ error: "memberId é obrigatório" }, { status: 400 });

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
