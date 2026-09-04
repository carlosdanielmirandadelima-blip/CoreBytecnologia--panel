// TD-05 — deployProject deve aguardar o fim do pull (followProgress) e propagar erro de pull.
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  pull: vi.fn(),
  createContainer: vi.fn(),
  followProgress: vi.fn(),
  getContainer: vi.fn(),
  ordem: [] as string[],
}));

vi.mock("dockerode", () => ({
  default: class MockDocker {
    pull = (...a: unknown[]) => d.pull(...a);
    createContainer = (...a: unknown[]) => d.createContainer(...a);
    getContainer = (...a: unknown[]) => d.getContainer(...a);
    modem = { followProgress: (...a: unknown[]) => d.followProgress(...a) };
  },
}));

const servico = { id: "s1", name: "web", image: "nginx:latest", ports: null, volumes: null, command: null, containerId: null };
const projeto = { id: "p1", name: "meu-app", services: [servico], envVars: [] };
const prismaMock = vi.hoisted(() => ({
  project: { findUnique: null as any, update: null as any },
  service: { update: null as any },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./prisma", () => ({ prisma: prismaMock }));

const streamFake = { fake: true };

beforeEach(() => {
  d.ordem.length = 0;
  d.pull.mockReset().mockResolvedValue(streamFake);
  d.followProgress.mockReset().mockImplementation((_s: unknown, cb: (e: unknown, o?: unknown) => void) => {
    setTimeout(() => {
      d.ordem.push("pull-concluido");
      cb(null, []);
    }, 15);
  });
  d.createContainer.mockReset().mockImplementation(async () => {
    d.ordem.push("createContainer");
    return {
      start: vi.fn().mockResolvedValue(undefined),
      inspect: vi.fn().mockResolvedValue({ Id: "c1", State: { Running: true } }),
    };
  });
  prismaMock.project.findUnique = vi.fn().mockResolvedValue(projeto);
  prismaMock.project.update = vi.fn().mockResolvedValue({});
  prismaMock.service.update = vi.fn().mockResolvedValue({});
});

describe("TD-05: docker.pull aguardado de verdade", () => {
  it("createContainer só roda DEPOIS do followProgress concluir", async () => {
    const { deployProject } = await import("@/lib/deploy");
    await deployProject("p1");
    expect(d.followProgress).toHaveBeenCalledTimes(1);
    expect(d.followProgress.mock.calls[0][0]).toBe(streamFake);
    expect(d.ordem).toEqual(["pull-concluido", "createContainer"]);
  });

  it("erro no pull propaga (não é engolido por catch vazio)", async () => {
    d.pull.mockRejectedValue(new Error("pull falhou: no such image"));
    const { deployProject } = await import("@/lib/deploy");
    await expect(deployProject("p1")).rejects.toThrow("pull falhou");
    expect(d.createContainer).not.toHaveBeenCalled();
  });

  it("erro reportado pelo followProgress também propaga", async () => {
    d.followProgress.mockImplementation((_s: unknown, cb: (e: unknown) => void) => {
      setTimeout(() => cb(new Error("stream interrompido")), 5);
    });
    const { deployProject } = await import("@/lib/deploy");
    await expect(deployProject("p1")).rejects.toThrow("stream interrompido");
    expect(d.createContainer).not.toHaveBeenCalled();
  });
});
