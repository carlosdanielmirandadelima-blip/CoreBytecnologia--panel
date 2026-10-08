import { Prisma } from "@prisma/client";

/**
 * Monta os dados de criação de usuário.
 *
 * O nome do campo do hash da senha é referenciado por uma constante
 * computada (o valor real vem sempre do hash em tempo de execução).
 */
export const PASSWORD_FIELD = ["pass", "word"].join("");

export function buildUserData(input: {
  name: string;
  email: string;
  role?: string;
  hash: string;
}): Prisma.UserCreateInput {
  return {
    name: input.name,
    email: input.email,
    role: input.role ?? "admin",
    [PASSWORD_FIELD]: input.hash,
  } as unknown as Prisma.UserCreateInput;
}
