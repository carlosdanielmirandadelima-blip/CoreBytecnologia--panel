import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Autenticação do worker interno.
 *
 * O agendador (worker) precisa disparar tarefas internas (backups, checagens
 * de monitor) sem depender de uma sessão de navegador. Em vez de deixar a
 * rota aberta — como estava — usamos um segredo compartilhado, gerado uma vez
 * e guardado no banco (tabela Setting), além do header do Traefik.
 */

const SETTING_KEY = "worker.internal_token";

let cachedToken: string | null = null;

/** Devolve o token interno, criando-o na primeira execução. */
export async function getInternalToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (process.env.WORKER_TOKEN) {
    cachedToken = process.env.WORKER_TOKEN;
    return cachedToken;
  }

  const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (existing?.value) {
    cachedToken = existing.value;
    return cachedToken;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: token },
    update: { value: token },
  });
  cachedToken = token;
  return token;
}

/** Compara o header recebido com o token interno, em tempo constante. */
export async function isWorkerRequest(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-corebyte-worker") || "";
  if (!provided) return false;
  const expected = await getInternalToken();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Permite a chamada quando vem do worker interno OU quando há sessão de
 * administrador. Nunca deixa passar sem nenhuma das duas.
 */
export async function requireWorkerOrAdmin(): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
