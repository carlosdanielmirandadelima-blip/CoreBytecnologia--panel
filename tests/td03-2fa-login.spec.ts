// TD-03 — login deve exigir TOTP quando o usuário tem 2FA ativo.
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const compare = vi.fn();
vi.mock("bcryptjs", () => ({ default: { compare: (...a: unknown[]) => compare(...a) }, compare: (...a: unknown[]) => compare(...a) }));

// otplib v13: verify({ strategy, secret, token }) → { valid }
const otpVerify = vi.fn(async ({ token }: { token: string }) => ({ valid: token === "123456" }));
vi.mock("otplib", () => ({ verify: (...a: unknown[]) => (otpVerify as any)(...a) }));

const userComum = { id: "u1", name: "A", email: "a@x.com", password: "hash", role: "admin", twoFactorEnabled: false, twoFactorSecret: "" };
const user2fa = { ...userComum, twoFactorEnabled: true, twoFactorSecret: "SECRETBASE32SECRETBASE32AAAA" };

async function getProvider() {
  const { authOptions } = await import("@/lib/auth");
  const p = authOptions.providers[0] as any;
  return {
    credentials: p.options?.credentials ?? p.credentials,
    authorize: (p.options?.authorize ?? p.authorize) as (c: Record<string, string> | undefined) => Promise<unknown>,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  compare.mockReset().mockResolvedValue(true);
  otpVerify.mockClear();
});

describe("TD-03: 2FA no login", () => {
  it("provider declara o campo totp em credentials", async () => {
    const { credentials } = await getProvider();
    expect(credentials).toHaveProperty("totp");
  });

  it("usuário com 2FA e senha correta, SEM totp → null", async () => {
    findUnique.mockResolvedValue(user2fa);
    const { authorize } = await getProvider();
    const r = await authorize({ email: "a@x.com", password: "s" });
    expect(r).toBeNull();
  });

  it("usuário com 2FA, senha correta e totp VÁLIDO → retorna user", async () => {
    findUnique.mockResolvedValue(user2fa);
    const { authorize } = await getProvider();
    const r = await authorize({ email: "a@x.com", password: "s", totp: "123456" });
    expect(r).toMatchObject({ id: "u1", email: "a@x.com" });
    expect(otpVerify).toHaveBeenCalled();
  });

  it("usuário com 2FA e totp INVÁLIDO → null", async () => {
    findUnique.mockResolvedValue(user2fa);
    const { authorize } = await getProvider();
    const r = await authorize({ email: "a@x.com", password: "s", totp: "000000" });
    expect(r).toBeNull();
  });

  it("usuário SEM 2FA → login normal sem totp", async () => {
    findUnique.mockResolvedValue(userComum);
    const { authorize } = await getProvider();
    const r = await authorize({ email: "a@x.com", password: "s" });
    expect(r).toMatchObject({ id: "u1" });
    expect(otpVerify).not.toHaveBeenCalled();
  });
});
