import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { verifyTwoFactorCode } from "@/lib/two-factor";
import { writeAudit } from "@/lib/audit";
import { DISABLED_TWO_FACTOR_FIELDS } from "@/lib/two-factor-fields";

/**
 * Desativa o 2FA.
 *
 * Antes não pedia nenhuma prova de identidade: com a sessão aberta, qualquer
 * um podia desligar o segundo fator. Agora exige um código válido do app.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code || "").replace(/\D/g, "");

  const record = await prisma.user.findUnique({ where: { id: user!.id } });
  if (!record) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  if (!record.twoFactorEnabled) {
    return NextResponse.json({ error: "O 2FA já está desativado" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { error: "Informe um código atual do aplicativo para desativar o 2FA" },
      { status: 400 }
    );
  }

  const valid = await verifyTwoFactorCode(record.twoFactorSecret, code);
  if (!valid) {
    return NextResponse.json({ error: "Código incorreto" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: record.id }, data: DISABLED_TWO_FACTOR_FIELDS });

  await writeAudit(req, {
    action: "two-factor.disable",
    resource: "user",
    resourceId: record.id,
    details: "2FA desativado",
    user,
  });

  return NextResponse.json({ ok: true, twoFactorEnabled: false });
}
