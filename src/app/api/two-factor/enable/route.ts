import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, "CoreByte Panel", secret);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ secret, qrCode: qrCodeUrl });
}
