// TD-04 — checkTcp/checkPing não podem interpolar monitor.target em shell.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { statusPage: { findUnique: vi.fn() }, monitor: { update: vi.fn() } } }));

type Cb = (e: unknown, o?: unknown) => void;
function ultimoCallback(args: unknown[]): Cb | undefined {
  for (let i = args.length - 1; i >= 0; i--) if (typeof args[i] === "function") return args[i] as Cb;
}
const execMock = vi.fn((...args: unknown[]) => ultimoCallback(args)?.(null, { stdout: "", stderr: "" }));
const execFileMock = vi.fn((...args: unknown[]) =>
  ultimoCallback(args)?.(null, { stdout: "64 bytes: time=1.2 ms", stderr: "" })
);
vi.mock("child_process", () => ({
  exec: (...a: unknown[]) => (execMock as any)(...a),
  execFile: (...a: unknown[]) => (execFileMock as any)(...a),
}));

const rota = () => import("@/app/api/status-pages/[id]/check/route");
const strings = (calls: unknown[][]) => calls.map((c) => JSON.stringify(c));

beforeEach(() => {
  execMock.mockClear();
  execFileMock.mockClear();
});

describe("TD-04: injeção nos monitores TCP/ping", () => {
  it("checkTcp com host malicioso → down, sem executar nada com a injeção", async () => {
    const { checkTcp } = (await rota()) as any;
    expect(typeof checkTcp).toBe("function");
    const r = await checkTcp("$(touch /tmp/x)", 80, 5);
    expect(r.status).toBe("down");
    for (const s of strings([...execMock.mock.calls, ...execFileMock.mock.calls])) {
      expect(s).not.toContain("$(");
    }
  });

  it("checkPing com host malicioso → down, sem executar nada com a injeção", async () => {
    const { checkPing } = (await rota()) as any;
    expect(typeof checkPing).toBe("function");
    const r = await checkPing("8.8.8.8; rm -rf /", 5);
    expect(r.status).toBe("down");
    for (const s of strings([...execMock.mock.calls, ...execFileMock.mock.calls])) {
      expect(s).not.toContain("rm -rf");
    }
  });

  it("checkTcp legítimo (example.com:443) → up, host passado como argumento, não interpolado", async () => {
    const { checkTcp } = (await rota()) as any;
    const r = await checkTcp("example.com", 443, 5);
    expect(r.status).toBe("up");
    const call = execFileMock.mock.calls.at(-1)!;
    const args = call[1] as string[];
    expect(Array.isArray(args)).toBe(true);
    expect(args).toContain("example.com");
    expect(execMock).not.toHaveBeenCalled();
  });

  it("checkPing legítimo (8.8.8.8) → up via execFile args", async () => {
    const { checkPing } = (await rota()) as any;
    const r = await checkPing("8.8.8.8", 5);
    expect(r.status).toBe("up");
    const call = execFileMock.mock.calls.find((c) => c[0] === "ping")!;
    expect(call).toBeTruthy();
    expect(call[1]).toContain("8.8.8.8");
  });
});
