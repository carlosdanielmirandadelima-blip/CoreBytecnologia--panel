// TD-02 — POST /api/backups/schedules/run deve exigir sessão.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("next-auth/next", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const findMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    backupSchedule: { findMany: (...a: unknown[]) => findMany(...a), update: vi.fn() },
    backup: { create: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn() },
  },
}));

const execMock = vi.fn((_cmd: string, cb?: (e: unknown, o?: unknown) => void) => {
  if (cb) cb(null, { stdout: "", stderr: "" });
});
vi.mock("child_process", () => ({ exec: (...a: unknown[]) => (execMock as any)(...a) }));

beforeEach(() => {
  getServerSession.mockReset();
  findMany.mockClear().mockResolvedValue([]);
  execMock.mockClear();
});

describe("TD-02: auth em /api/backups/schedules/run", () => {
  it("sem sessão → 401, sem tocar em prisma nem exec", async () => {
    getServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/backups/schedules/run/route");
    const res = await POST();
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
  });

  it("com sessão válida → 200 e consulta schedules vencidos", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", email: "a@x.com" } });
    const { POST } = await import("@/app/api/backups/schedules/run/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ executed: 0, results: [] });
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
