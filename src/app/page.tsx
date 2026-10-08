import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Página inicial.
 *
 * O primeiro acesso precisa ser a criação do administrador: se ainda não
 * existe usuário, o dono define e-mail e senha antes de entrar no painel.
 * Depois disso, a raiz leva para o dashboard (e o middleware cuida do login).
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  let needsSetup = false;
  try {
    needsSetup = (await prisma.user.count()) === 0;
  } catch {
    // Banco ainda não migrado: manda para o setup, que explica o estado.
    needsSetup = true;
  }

  redirect(needsSetup ? "/setup" : "/dashboard");
}
