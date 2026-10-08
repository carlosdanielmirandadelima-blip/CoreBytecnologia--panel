import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Autenticação por API key.
 *
 * Correções:
 *  - a chave NÃO é mais comparada em texto puro: guardamos apenas um hash
 *    (como uma senha), então um vazamento do banco não expõe as chaves;
 *  - as permissões (`read` / `write`) passam a ser verificadas de fato —
 *    antes o campo era gravado mas nunca consultado, e uma chave "read"
 *    podia executar qualquer operação.
 */

export type ApiPermission = "read" | "write";

export interface ApiAuthResult {
  userId: string;
  permissions: string;
}

/** Hash determinístico para permitir busca por índice. */
export function hashApiKey(rawKey: string): string {
  const pepper = process.env.NEXTAUTH_SECRET || "corebyte-api-key-pepper";
  return crypto.createHash("sha256").update(`${pepper}:${rawKey}`).digest("hex");
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult | null> {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;

  const raw = header.slice(7).trim();
  if (!raw) return null;

  const digest = hashApiKey(raw);

  // Busca por hash. Chaves antigas gravadas em texto puro continuam
  // funcionando e são migradas para hash automaticamente.
  let record = await prisma.apiKey.findUnique({ where: { key: digest } });

  if (!record) {
    const legacy = await prisma.apiKey.findUnique({ where: { key: raw } });
    if (!legacy) return null;
    record = await prisma.apiKey.update({ where: { id: legacy.id }, data: { key: digest } });
  }

  if (record.expiresAt && record.expiresAt < new Date()) return null;

  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsed: new Date() } });

  return { userId: record.userId, permissions: record.permissions };
}

/**
 * Verifica se a requisição pode executar a operação pedida.
 * Uso: `const { auth, error } = await requireApiKey(req, "write")`.
 */
export async function requireApiKey(
  req: NextRequest,
  needed: ApiPermission
): Promise<{ auth?: ApiAuthResult; error?: Response }> {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return {
      error: new Response(JSON.stringify({ error: "Chave de API inválida ou ausente" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const list = String(auth.permissions || "read")
    .split(",")
    .map((p) => p.trim());

  const allowed = list.includes("admin") || list.includes(needed);
  if (!allowed) {
    return {
      error: new Response(
        JSON.stringify({
          error: `Esta chave não tem permissão de ${needed === "write" ? "escrita" : "leitura"}`,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { auth };
}
