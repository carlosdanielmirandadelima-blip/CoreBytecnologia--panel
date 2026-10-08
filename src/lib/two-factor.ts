import QRCode from "qrcode";
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import { encryptSecret, decryptSecret } from "./crypto";

/**
 * Autenticação de dois fatores (TOTP).
 *
 * Usa a API do otplib v13 (o projeto importava `authenticator`, que só existe
 * na v9, e por isso o 2FA quebrava em runtime).
 */

const ISSUER = "CoreByte Panel";

function totp() {
  return new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });
}

/** Gera um novo segredo TOTP (base32, 32 caracteres). */
export function generateTwoFactorSecret(): string {
  return totp().generateSecret();
}

/** Monta a URI otpauth:// para o aplicativo autenticador. */
export function buildOtpAuthUri(email: string, secret: string): string {
  return totp().toURI({ label: email, issuer: ISSUER, secret });
}

/** Gera o QR Code (data URL) para leitura no aplicativo. */
export async function buildQrCodeDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(buildOtpAuthUri(email, secret), { margin: 1, width: 256 });
}

/** Valida um código de 6 dígitos contra o segredo (cifrado no banco). */
export async function verifyTwoFactorCode(sealedSecret: string, token: string): Promise<boolean> {
  const clean = String(token || "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const secret = decryptSecret(sealedSecret);
  if (!secret) return false;
  try {
    const result = await totp().verify(clean, { secret });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

/** Cifra o segredo antes de gravar no banco. */
export function sealTwoFactorSecret(secret: string): string {
  return encryptSecret(secret);
}

/**
 * Guarda um desafio de 2FA de curta duração, usado entre o login por senha
 * e a confirmação do código. Mantido em memória (o fluxo é curto) e
 * limitado por tempo para não acumular.
 */
interface Challenge {
  userId: string;
  expiresAt: number;
  attempts: number;
}

const challenges = new Map<string, Challenge>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function sweep() {
  const now = Date.now();
  challenges.forEach((c, id) => {
    if (c.expiresAt <= now || c.attempts >= MAX_ATTEMPTS) challenges.delete(id);
  });
}

export function createChallenge(userId: string): string {
  sweep();
  const token = crypto.randomUUID().replace(/-/g, "");
  challenges.set(token, { userId, expiresAt: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });
  return token;
}

export function readChallenge(token: string): Challenge | undefined {
  sweep();
  return challenges.get(token);
}

export function consumeChallenge(token: string): void {
  challenges.delete(token);
}

export function registerAttempt(token: string): void {
  const c = challenges.get(token);
  if (c) c.attempts += 1;
}
