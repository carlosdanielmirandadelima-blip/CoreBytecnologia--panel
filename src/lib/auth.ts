import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { verifyTwoFactorCode, createChallenge } from "./two-factor";
import { LOGIN_FIELDS } from "./login-fields";

/**
 * Autenticação por credenciais + segundo fator (TOTP).
 *
 * O segredo de assinatura da sessão vem da variável de ambiente
 * NEXTAUTH_SECRET, lida automaticamente pelo NextAuth (não fica no código).
 *
 * Correções aplicadas:
 *  - limite de tentativas por conta (proteção contra força bruta);
 *  - mensagens genéricas, sem revelar se o e-mail existe;
 *  - o código TOTP agora é exigido de fato quando o usuário tem 2FA ativo
 *    (antes o authorize() ignorava twoFactorEnabled por completo).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: LOGIN_FIELDS,
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Proteção contra força bruta por conta.
        if (isRateLimited(email)) throw new Error("RATE_LIMITED");

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          registerFailure(email);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          registerFailure(email);
          return null;
        }

        clearFailures(email);

        // Segundo fator: agora é realmente exigido (antes era ignorado).
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const code = String(credentials.code || "").replace(/\D/g, "");
          if (!code) {
            // Sinaliza à tela de login que precisa do código.
            throw new Error("TWO_FACTOR_REQUIRED:" + createChallenge(user.id));
          }
          const ok = await verifyTwoFactorCode(user.twoFactorSecret, code);
          if (!ok) throw new Error("TWO_FACTOR_INVALID");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      // Se o token não trouxer papel (sessões antigas), recarrega do banco.
      if (token.id && !token.role) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};

/* ------------------------------------------------------------------ */
/* Limite de tentativas de login (força bruta)                          */
/* ------------------------------------------------------------------ */

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil?: number;
}

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const BLOCK_MS = 15 * 60 * 1000;

function isRateLimited(email: string): boolean {
  const a = attempts.get(email);
  if (!a) return false;
  if (a.blockedUntil && a.blockedUntil > Date.now()) return true;
  if (a.firstAt + WINDOW_MS < Date.now()) {
    attempts.delete(email);
    return false;
  }
  return false;
}

function registerFailure(email: string) {
  const now = Date.now();
  const a = attempts.get(email);
  if (!a || a.firstAt + WINDOW_MS < now) {
    attempts.set(email, { count: 1, firstAt: now });
    return;
  }
  a.count += 1;
  if (a.count >= MAX_FAILURES) a.blockedUntil = now + BLOCK_MS;
  attempts.set(email, a);
}

function clearFailures(email: string) {
  attempts.delete(email);
}

/** Comparação em tempo constante para tokens internos. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
