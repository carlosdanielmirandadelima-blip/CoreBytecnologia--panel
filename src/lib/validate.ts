/**
 * Validadores usados nas rotas de API.
 *
 * Substituem a prática anterior de repassar campos do usuário direto para
 * comandos de shell (que permitia injeção) e deixá-los ir crus para o banco.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Nome de volume, container ou imagem do Docker. */
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
/** IP, hostname ou domínio — sem caracteres de shell. */
const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]{0,251})$/;
/** Caminho absoluto simples, sem metacaracteres. */
const PATH_RE = /^\/[a-zA-Z0-9._\/-]{0,4095}$/;

export function assertName(value: unknown, field = "nome"): string {
  const s = String(value ?? "").trim();
  if (!NAME_RE.test(s)) {
    throw new ValidationError(
      `O campo "${field}" só pode conter letras, números, ponto, hífen e underline (até 128 caracteres).`
    );
  }
  return s;
}

export function assertHost(value: unknown, field = "host"): string {
  const s = String(value ?? "").trim();
  if (!HOST_RE.test(s) || s.includes("..")) {
    throw new ValidationError(`O campo "${field}" não é um host válido.`);
  }
  return s;
}

export function assertPort(value: unknown, field = "porta"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new ValidationError(`O campo "${field}" deve ser uma porta entre 1 e 65535.`);
  }
  return n;
}

/** Caminho absoluto válido, sem metacaracteres de shell. */
export function assertSafePath(value: unknown, field = "caminho"): string {
  const s = String(value ?? "").trim();
  if (!PATH_RE.test(s)) {
    throw new ValidationError(
      `O campo "${field}" deve ser um caminho absoluto válido, sem caracteres especiais.`
    );
  }
  if (s.includes("..")) {
    throw new ValidationError(`O campo "${field}" não pode conter "..".`);
  }
  return s;
}

/**
 * Origem de backup: volume do Docker, caminho no host, container ou
 * projeto. Aqui aplicamos a allow-list de formato — nunca mais vai para
 * o shell sem validação.
 */
export function assertBackupSource(value: unknown, type: string): string {
  const s = String(value ?? "").trim();
  if (!s) throw new ValidationError("Informe a origem do backup.");

  if (type === "volume") {
    // Nome de volume do Docker (não caminho).
    return assertName(s, "volume");
  }
  if (type === "container") {
    return assertName(s, "container");
  }
  if (type === "file" || type === "path") {
    return assertSafePath(s, "caminho");
  }
  throw new ValidationError(`Tipo de backup desconhecido: ${type}`);
}

export function assertEmail(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 254) {
    throw new ValidationError("Informe um e-mail válido.");
  }
  return s;
}

export function assertPasswordStrength(value: unknown): string {
  const s = String(value ?? "");
  if (s.length < 10) {
    throw new ValidationError("A senha deve ter pelo menos 10 caracteres.");
  }
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) {
    throw new ValidationError("A senha deve combinar letras e números.");
  }
  return s;
}

export function assertUrl(value: unknown, field = "URL", protocols = ["http:", "https:"]): string {
  const s = String(value ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    throw new ValidationError(`O campo "${field}" não é uma URL válida.`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new ValidationError(`O campo "${field}" deve usar ${protocols.join(" ou ")}.`);
  }
  return s;
}

export function assertString(value: unknown, field: string, max = 5000, required = false): string {
  const s = String(value ?? "").trim();
  if (required && !s) throw new ValidationError(`O campo "${field}" é obrigatório.`);
  if (s.length > max) throw new ValidationError(`O campo "${field}" excede ${max} caracteres.`);
  return s;
}

/** Converte "8080:80" ou {"host":"8080","container":"80"} em string canônica. */
export function normalizePortMapping(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") {
    const parts = input.split(":");
    if (parts.length < 2) {
      throw new ValidationError(`Mapeamento de porta inválido: "${input}". Use host:container.`);
    }
    const host = String(parts[0]).trim();
    const container = String(parts[1]).trim();
    if (host) assertPort(host, "porta do host");
    assertPort(container, "porta do container");
    return `${host}:${container}`;
  }
  if (typeof input === "object") {
    const o = input as { host?: unknown; container?: unknown };
    if (o.host !== undefined && o.container !== undefined) {
      assertPort(o.host, "porta do host");
      assertPort(o.container, "porta do container");
      return `${o.host}:${o.container}`;
    }
  }
  throw new ValidationError("Mapeamento de porta inválido.");
}

/** Converte "vol:/caminho" ou {"source","target"} em string canônica. */
export function normalizeVolumeMapping(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") {
    const idx = input.indexOf(":");
    if (idx <= 0) throw new ValidationError(`Mapeamento de volume inválido: "${input}". Use origem:destino.`);
    const source = input.slice(0, idx).trim();
    const target = input.slice(idx + 1).trim();
    if (!source || !target.startsWith("/")) {
      throw new ValidationError(`Mapeamento de volume inválido: "${input}".`);
    }
    assertName(source, "nome do volume");
    assertSafePath(target, "destino do volume");
    return `${source}:${target}`;
  }
  if (typeof input === "object") {
    const o = input as { source?: unknown; target?: unknown };
    if (o.source && o.target) {
      assertName(o.source, "nome do volume");
      assertSafePath(o.target, "destino do volume");
      return `${o.source}:${o.target}`;
    }
  }
  throw new ValidationError("Mapeamento de volume inválido.");
}

/**
 * Valida o domínio de um projeto antes de virar label do Traefik.
 * Aceita "app.exemplo.com", "app.exemplo.com/path" e "http://..." (normaliza).
 */
export function assertDomain(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // Um padrão pode conter {sub} ou * (wildcard do Traefik).
  if (!/^[a-zA-Z0-9*{}][a-zA-Z0-9._*{}-]*(\/[a-zA-Z0-9._/-]*)?$/.test(cleaned)) {
    throw new ValidationError(`Domínio inválido: "${raw}"`);
  }
  if (cleaned.includes("..") || /[^a-zA-Z0-9._*{}/-]/.test(cleaned)) {
    throw new ValidationError(`Domínio inválido: "${raw}"`);
  }
  return cleaned;
}

/** Reconhece se o valor é um email, e retorna o usuário. */
export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}
