import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Proteção de rotas.
 *
 * Antes o matcher cobria apenas as páginas: nenhuma rota de /api era
 * protegida, e 10 endpoints ficavam abertos à internet (gravar credenciais
 * de nuvem, executar backups, registrar admin…).
 *
 * Agora:
 *  - páginas exigem sessão (redireciona para /login);
 *  - /api responde 401 em JSON (sem redirecionar HTML, para o frontend e
 *    scripts conseguirem tratar o erro);
 *  - ficam públicas apenas: /login, /register, /setup (primeiro acesso), a página de status,
 *    o fluxo de auth, o endpoint de configuração inicial e a API interna
 *    do worker / API v1 (que têm autenticação própria).
 *
 * O segredo de assinatura é lido da variável de ambiente NEXTAUTH_SECRET
 * automaticamente pelo NextAuth.
 */

const PUBLIC_API_PREFIXES = [
  "/api/auth", // login do NextAuth e configuração inicial
  "/api/status", // status page pública
  "/api/worker", // token interno (x-corebyte-worker)
  "/api/v1", // chave de API
];

const PUBLIC_PAGES = ["/login", "/register", "/setup"];

function isPublicPath(pathname: string): boolean {
  // A raiz é pública de propósito: ela decide entre /setup (primeiro acesso,
  // quando ainda não existe administrador) e /dashboard. Se exigisse sessão
  // aqui, o middleware mandaria para /login antes dessa decisão acontecer.
  if (pathname === "/") return true;

  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // Página pública de disponibilidade
  if (pathname === "/status" || pathname.startsWith("/status/")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await getToken({ req });

  if (session) return NextResponse.next();

  // Chamadas de API recebem JSON; navegação recebe redirecionamento.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto arquivos estáticos e imagens do Next.
     * As exceções de autenticação são tratadas em isPublicPath().
     */
    "/((?!_next/static|_next/image|favicon\\.ico|assets/|manifest\\.json).*)",
  ],
};
