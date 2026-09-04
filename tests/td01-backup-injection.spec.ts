// TD-01 — POST /api/backups não pode interpolar entrada do usuário em shell.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const backupCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    backup: {
      create: (...a: unknown[]) => backupCreate(...a),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const execMock = vi.fn((_c: string, cb?: (e: unknown, o?: string) => void) => cb && cb(null, ""));
const execFileMock = vi.fn(
  (_f: string, _args?: unknown, cb?: (e: unknown, o?: string) => void) => {
    if (typeof _args === "function") (_args as (e: unknown, o?: string) => void)(null, "");
    else if (cb) cb(null, "");
  }
);
vi.mock("child_process", () => ({
  exec: (...a: unknown[]) => (execMock as any)(...a),
  execFile: (...a: unknown[]) => (execFileMock as any)(...a),
}));

function post(body: unknown) {
  return new Request("http://local/api/backups", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const tick = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { id: "u1" } });
  backupCreate.mockReset().mockImplementation(async ({ data }: any) => ({ id: "b1", ...data }));
  execMock.mockClear();
  execFileMock.mockClear();
});

describe("TD-01: injeção de comando no backup", () => {
  it("source com metacaracteres de shell → 400, nada executado", async () => {
    const { POST } = await import("@/app/api/backups/route");
    const res = await POST(post({ name: "x", type: "path", source: "/tmp; touch /tmp/pwned" }) as never);
    await tick();
    expect(res.status).toBe(400);
    expect(backupCreate).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("name com path traversal → 400 e filePath jamais sai do BACKUP_DIR", async () => {
    const { POST } = await import("@/app/api/backups/route");
    const res = await POST(post({ name: "../evil", type: "volume", source: "vol" }) as never);
    await tick();
    expect(res.status).toBe(400);
    expect(backupCreate).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("caso legítimo (volume) → 201, docker via execFile com args, filePath dentro de BACKUP_DIR", async () => {
    const { POST } = await import("@/app/api/backups/route");
    const res = await POST(post({ name: "meu backup", type: "volume", source: "meu-volume" }) as never);
    await tick();
    expect(res.status).toBe(201);
    // filePath registrado permanece dentro do diretório de backups
    const data = backupCreate.mock.calls[0][0].data;
    expect(data.filePath.includes("..")).toBe(false);
    expect(data.filePath.endsWith(`/backups/${data.fileName}`)).toBe(true);
    // execução via execFile com array de args, sem string shell interpolada
    const dockerCall = execFileMock.mock.calls.find((c) => c[0] === "docker");
    expect(dockerCall).toBeTruthy();
    expect(dockerCall![1]).toContain("meu-volume:/data");
    expect(execMock).not.toHaveBeenCalled();
  });
});
