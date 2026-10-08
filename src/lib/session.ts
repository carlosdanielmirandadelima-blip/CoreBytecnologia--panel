import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface AuthResult {
  session: unknown;
  user: SessionUser | null;
  error: NextResponse | null;
}

/**
 * Exige uma sessão válida. Use no topo de todas as rotas de API.
 *
 * Antes, 10 rotas não checavam sessão e ficavam abertas à internet.
 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;
  if (!session || !user?.id) {
    return {
      session: null,
      user: null,
      error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
    };
  }
  return { session, user, error: null };
}

/** Exige sessão e papel de administrador. */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireSession();
  if (result.error) return result;
  if (result.user?.role !== "admin") {
    return {
      session: result.session,
      user: result.user,
      error: NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * Verifica se o usuário pertence ao time informado.
 * Sem `teamId` retorna true (recursos globais, sem dono).
 */
export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  if (!teamId) return true;
  const membership = await prisma.teamMember.findFirst({ where: { userId, teamId } });
  return Boolean(membership);
}

/**
 * Confere permissão de um recurso que pertence a um time.
 * Lança 404/403 quando o acesso não é permitido.
 */
export async function assertTeamAccess(
  user: SessionUser,
  teamId: string | null | undefined
): Promise<NextResponse | null> {
  if (!teamId) return null; // recurso sem dono (global)
  if (user.role === "admin") return null;
  const ok = await isTeamMember(user.id, teamId);
  if (!ok) {
    return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
  }
  return null;
}
