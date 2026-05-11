import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, twoFactorEnabled: true, createdAt: true },
  });

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, email, currentPassword, newPassword } = body;

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email ?? "" },
  });

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const updateData: Record<string, string> = {};

  if (name && name !== user.name) {
    updateData.name = name;
  }

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email já está em uso" }, { status: 400 });
    updateData.email = email;
  }

  if (currentPassword && newPassword) {
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: "Nova senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "Nenhuma alteração" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
  });

  return NextResponse.json(updated);
}
