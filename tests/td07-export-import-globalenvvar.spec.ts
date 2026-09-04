// TD-07 — export/import devem usar o modelo real globalEnvVar (prisma.variable não existe).
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const envVar = { id: "v1", key: "API_URL", value: "http://x", description: "" };
const findManyVazio = () => vi.fn().mockResolvedValue([]);
const globalEnvVar = {
  findMany: vi.fn().mockResolvedValue([envVar]),
  upsert: vi.fn().mockResolvedValue(envVar),
};
// Apenas modelos que EXISTEM no schema — sem `variable`.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findMany: findManyVazio() },
    globalEnvVar,
    team: { findMany: findManyVazio() },
    statusPage: { findMany: findManyVazio() },
    cluster: { findMany: findManyVazio() },
    scalingRule: { findMany: findManyVazio() },
    pipeline: { findMany: findManyVazio() },
    dynamicDns: { findMany: findManyVazio(), upsert: vi.fn() },
    buildJob: { findMany: findManyVazio() },
    appTemplate: { findMany: findManyVazio() },
  },
}));

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { id: "u1" } });
  globalEnvVar.findMany.mockClear().mockResolvedValue([envVar]);
  globalEnvVar.upsert.mockClear().mockResolvedValue(envVar);
});

describe("TD-07: export/import com globalEnvVar", () => {
  it("GET /api/export retorna 200 com as env vars preenchidas", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.variables).toEqual([envVar]);
    expect(globalEnvVar.findMany).toHaveBeenCalledTimes(1);
  });

  it("POST /api/import grava env vars via globalEnvVar.upsert", async () => {
    const { POST } = await import("@/app/api/import/route");
    const req = new Request("http://local/api/import", {
      method: "POST",
      body: JSON.stringify({
        panel: "CoreByte Panel",
        data: { variables: [envVar] },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, imported: { variables: 1 } });
    expect(globalEnvVar.upsert).toHaveBeenCalledTimes(1);
    expect(globalEnvVar.upsert.mock.calls[0][0]).toMatchObject({
      where: { id: "v1" },
      create: { key: "API_URL", value: "http://x" },
    });
  });
});
