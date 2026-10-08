import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { verifyTwoFactorCode } from "@/lib/two-factor";
import { writeAudit } from "@/lib/audit";

/**
 * Confirma o primeiro código e ativa o 2FA.
 * Valida o código contra o segredo cifrado.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) {
    return NextResponse.json({ error: "Informe o código de 6 dígitos" }, { status: 400 });
  }

  const record = await prisma.user.findUnique({ where: { id: user!.id } });
  if (!record) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!record.twoFactorSecret) {
    return NextResponse.json({ error: "Inicie a ativação do 2FA antes de confirmar" }, { status: 400 });
  }

  const valid = await verifyTwoFactorCode(record.twoFactorSecret, code);
  if (!valid) {
    return NextResponse.json({ error: "Código incorreto. Verifique o relógio do aplicativo." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: record.id }, data: { twoFactorEnabled: true } });

  await writeAudit(req, {
    action: "two-factor.enable",
    resource: "user",
    resourceId: record.id,
    details: "2FA ativado",
    user,
  });

  return NextResponse.json({ ok: true, twoFactorEnabled: true });
}
