import net from "net";
import { assertHost, assertPort } from "./validate";

/**
 * Checagens de monitoramento (HTTP, TCP, ping).
 *
 * Antes o TCP era verificado com `bash -c 'echo > /dev/tcp/host/port'` e o
 * ping com `ping -c 1 -W ...` montados por string — injeção de comando pelo
 * campo `target` do monitor. Agora não há shell: o TCP usa um socket nativo,
 * o HTTP usa fetch e o ping usa execFile com argumentos separados.
 */

export interface MonitorResult {
  status: "up" | "down" | "degraded";
  responseTime: number;
  message: string;
}

/** Verificação HTTP/HTTPS. */
export async function checkHttp(target: string, timeoutSec: number): Promise<MonitorResult> {
  const start = Date.now();
  // Só http/https: impede esquemas perigosos (file:, gopher:, etc.).
  if (!/^https?:\/\//i.test(target)) {
    return { status: "down", responseTime: 0, message: "URL deve começar com http:// ou https://" };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000);
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CoreByte-Monitor/1.0" },
    });
    clearTimeout(timer);
    const responseTime = Date.now() - start;
    // Aceita um código esperado opcional no formato "url|200".
    return {
      status: res.ok ? "up" : "degraded",
      responseTime,
      message: `HTTP ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "Tempo esgotado" : "Falha na conexão";
    return { status: "down", responseTime: Date.now() - start, message: msg };
  }
}

/** Verificação de porta TCP, sem shell. */
export async function checkTcp(host: string, port: number, timeoutSec: number): Promise<MonitorResult> {
  const start = Date.now();
  let safeHost: string;
  let safePort: number;
  try {
    safeHost = assertHost(host, "host do monitor");
    safePort = assertPort(port, "porta do monitor");
  } catch {
    return { status: "down", responseTime: 0, message: "Host ou porta inválidos" };
  }

  return new Promise<MonitorResult>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: MonitorResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(Math.max(1, timeoutSec) * 1000);
    socket.once("connect", () =>
      finish({ status: "up", responseTime: Date.now() - start, message: `Porta ${safePort} aberta` })
    );
    socket.once("timeout", () =>
      finish({ status: "down", responseTime: Date.now() - start, message: "Tempo esgotado" })
    );
    socket.once("error", () =>
      finish({ status: "down", responseTime: Date.now() - start, message: `Porta ${safePort} fechada` })
    );

    socket.connect(safePort, safeHost);
  });
}

/** Ping usando execFile (sem shell, argumentos separados). */
export async function checkPing(host: string, timeoutSec: number): Promise<MonitorResult> {
  const start = Date.now();
  let safeHost: string;
  try {
    safeHost = assertHost(host, "host do monitor");
  } catch {
    return { status: "down", responseTime: 0, message: "Host inválido" };
  }

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync(
      "ping",
      ["-c", "1", "-W", String(Math.max(1, timeoutSec)), safeHost],
      { timeout: Math.max(1, timeoutSec) * 1000 + 1000 }
    );
    const match = stdout.match(/time=([\d.]+)/);
    const responseTime = match ? Math.round(parseFloat(match[1])) : Date.now() - start;
    return { status: "up", responseTime, message: `Ping ${responseTime}ms` };
  } catch {
    return { status: "down", responseTime: Date.now() - start, message: "Ping falhou" };
  }
}

/** Despacha conforme o tipo do monitor. */
export async function checkMonitor(monitor: {
  type: string;
  target: string;
  timeout: number;
}): Promise<MonitorResult> {
  const timeout = monitor.timeout || 10;
  switch (monitor.type) {
    case "http":
    case "https":
      return checkHttp(monitor.target, timeout);
    case "tcp": {
      const [host, portStr] = monitor.target.split(":");
      return checkTcp(host || "", Number(portStr) || 80, timeout);
    }
    case "ping":
      return checkPing(monitor.target, timeout);
    default:
      return { status: "unknown" as MonitorResult["status"], responseTime: 0, message: "Tipo desconhecido" };
  }
}
