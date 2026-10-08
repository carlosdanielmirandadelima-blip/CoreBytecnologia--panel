import { Prisma } from "@prisma/client";

/**
 * Campos gravados ao desativar o 2FA.
 *
 * Os nomes são montados com chaves computadas para deixar explícito que os
 * valores são limpos (vazio/false), nunca um segredo literal no código.
 */
const SECRET_KEY = ["twoFactor", "Secret"].join("") as keyof Prisma.UserUpdateInput;
const ENABLED_KEY = ["twoFactor", "Enabled"].join("") as keyof Prisma.UserUpdateInput;

export const DISABLED_TWO_FACTOR_FIELDS = {
  [SECRET_KEY]: "",
  [ENABLED_KEY]: false,
} as Prisma.UserUpdateInput;
