import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { assertEmail, assertPasswordStrength, assertString, ValidationError } from "@/lib/validate";
import { writeAudit, clientIp } from "@/lib/audit";
import { buildUserData } from "@/lib/user-data";

/**
 * Configuração inicial do painel (primeiro administrador).
 *
 * Antes: um POST público criava o primeiro usuário como `admin`. Como o
 * instalador não criava administrador, qualquer pessoa que encontrasse a URL
 * antes do dono se cadastrava como administrador — tomada de conta garantida.
 *
 * Agora:
 *  - só funciona enquanto NÃO existe nenhum usuário;
 *  - exige o código de configuração definido no .env pelo instalador
 *    (COREBYTE_SETUP_TOKEN) OU uma chamada vinda de dentro da rede do servidor;
 *  - o código NUNCA é devolvido por HTTP — fica no .env e no terminal;
 *  - exige senha forte, é auditada e tem limite de tentativas.
 *
 * Caminho recomendado: criar o administrador pelo terminal com
 * `npm run setup:admin` (scripts/setup-admin.ts).
 */

const ENV_NAME = "COREBYTE_SETUP_TOKEN";

/** Código de configuração: vem do ambiente, criado pelo instalador. */
function expectedCode(): string {
  return process.env[ENV_NAME] || "";
}

/** Considera local quando a chamada parte da rede interna do servidor. */
function isLocalRequest(req: NextRequest): boolean {
  const ip = clientIp(req) || "";
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.")
  );
}

/** GET — apenas informa se o painel precisa de configuração inicial. */
export async function GET(req: NextRequest) {
  const userCount = await prisma.user.count();
  const needsSetup = userCount === 0;

  return NextResponse.json({
    needsSetup,
    // Nunca devolve o código (ele fica no .env). Só explica como prosseguir.
    hint: !needsSetup
      ? "O painel já está configurado."
      : expectedCode()
      ? "Nenhum administrador existe. Informe o código de configuração mostrado pelo instalador."
      : "Nenhum administrador existe. Rode `npm run setup:admin` no servidor para criar a conta.",
    canSetupFromBrowser: needsSetup && Boolean(expectedCode()),
    canSetupFromHere: needsSetup && isLocalRequest(req),
  });
}

/** POST — cria o primeiro administrador (somente uma vez). */
export async function POST(req: NextRequest) {
  const attemptsKey = clientIp(req) || "unknown";
  if (isRateLimited(attemptsKey)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    registerFailure(attemptsKey);
    return NextResponse.json(
      { error: "O painel já possui administrador. Crie novas contas dentro do painel." },
      { status: 403 }
    );
  }

  const provided = req.headers.get("x-corebyte-setup") || "";
  const expected = expectedCode();
  const local = isLocalRequest(req);

  const codeOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!codeOk && !local) {
    registerFailure(attemptsKey);
    return NextResponse.json(
      {
        error:
          "Código de configuração inválido. Ele está no arquivo .env do servidor (COREBYTE_SETUP_TOKEN) e foi mostrado pelo instalador.",
      },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as { name?: string; email?: string; password?: string };
    const name = assertString(body.name, "nome", 120, true);
    const email = assertEmail(body.email);
    const plain = assertPasswordStrength(body.password);
    const hash = await bcrypt.hash(plain, 12);

    const user = await prisma.user.create({
      data: buildUserData({ name, email, role: "admin", hash }),
    });

    await writeAudit(req, {
      action: "setup.create-admin",
      resource: "user",
      resourceId: user.id,
      details: `Administrador inicial criado (${email})`,
      user: { id: user.id, name: user.name, email: user.email },
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        message: "Administrador criado. Faça login e remova o COREBYTE_SETUP_TOKEN do .env.",
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível criar o administrador" }, { status: 500 });
  }
}

/* Limite simples de tentativas para o endpoint de configuração. */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 10;

function isRateLimited(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (a.firstAt + WINDOW_MS < Date.now()) {
    attempts.delete(key);
    return false;
  }
  return a.count >= MAX;
}

function registerFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.firstAt + WINDOW_MS < now) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  a.count += 1;
}
