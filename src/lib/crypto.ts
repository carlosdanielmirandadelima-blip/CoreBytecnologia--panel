import crypto from "crypto";

/**
 * Criptografia simétrica das credenciais de nuvem (AES-256-GCM).
 *
 * As credenciais de backup (chaves S3, tokens OAuth, senhas de FTP/SFTP)
 * ficam gravadas em texto no banco se não forem cifradas. Aqui elas são
 * seladas com uma chave derivada de APP_SECRET (ou NEXTAUTH_SECRET).
 */

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "APP_SECRET (ou NEXTAUTH_SECRET) precisa estar definido com pelo menos 16 caracteres para cifrar credenciais de nuvem."
    );
  }
  // Deriva uma chave de 32 bytes estável a partir do segredo.
  return crypto.createHash("sha256").update(`corebyte-storage:${raw}`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  if (isEncrypted(plain)) return plain;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(sealed: string): string {
  if (!sealed) return "";
  if (!isEncrypted(sealed)) return sealed; // tolera dados legados em texto puro
  try {
    const key = getKey();
    const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Cifra cada valor de um objeto de credenciais. */
export function encryptConfig(config: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(config ?? {}));
}

/** Decifra o blob de credenciais; devolve {} se estiver corrompido. */
export function decryptConfig(sealed: string): Record<string, string> {
  if (!sealed) return {};
  try {
    const parsed = JSON.parse(decryptSecret(sealed) || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Máscara para exibir credenciais na interface sem revelar o valor. */
export function maskValue(value: string | undefined | null): string {
  if (!value) return "";
  const s = String(value);
  if (s.length <= 4) return "••••";
  return "••••••••" + s.slice(-4);
}
