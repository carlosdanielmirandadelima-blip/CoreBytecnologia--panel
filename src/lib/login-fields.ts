/**
 * Descritores dos campos do formulário de login.
 *
 * Ficam separados porque são apenas metadados de formulário para o NextAuth
 * (rótulo e tipo de input) — não contêm nenhum valor secreto.
 * O campo "code" é o segundo fator (TOTP).
 */
export const LOGIN_FIELDS = {
  email: { label: "Email", type: "email" as const },
  password: { label: "Senha", type: "password" as const },
  code: { label: "Código 2FA", type: "text" as const },
};
