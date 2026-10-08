import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateTwoFactorSecret, buildQrCodeDataUrl, sealTwoFactorSecret } from "@/lib/two-factor";
import { writeAudit } from "@/lib/audit";

/**
 * Inicia a ativação do 2FA.
 *
 * Antes usava `authenticator` do otplib, que não existe na v13 — a rota
 * quebrava em runtime. Agora usa a API atual (TOTP + plugins) e o segredo é
 * gravado CIFRADO (antes ficava em texto puro no banco).
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  const record = await prisma.user.findUnique({ where: { id: user!.id } });
  if (!record) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const secret = generateTwoFactorSecret();
  const qrCode = await buildQrCodeDataUrl(record.email, secret);

  // Só é ativado após a confirmação do primeiro código.
  await prisma.user.update({
    where: { id: record.id },
    data: { twoFactorSecret: sealTwoFactorSecret(secret), twoFactorEnabled: false },
  });

  await writeAudit(req, {
    action: "two-factor.start",
    resource: "user",
    resourceId: record.id,
    details: "Ativação do 2FA iniciada",
    user,
  });

  return NextResponse.json({ secret, qrCode });
}
