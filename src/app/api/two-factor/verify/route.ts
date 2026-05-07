import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA não foi iniciado. Gere o QR code primeiro." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { code } = body;

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });

    if (!isValid) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true, message: "2FA ativado com sucesso!" });
  } catch {
    return NextResponse.json({ error: "Erro ao verificar código" }, { status: 500 });
  }
}
