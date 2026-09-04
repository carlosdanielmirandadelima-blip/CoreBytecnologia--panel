import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Precedente caso-004-td01 (command-injection): validar com regex estrita e
// trocar exec(string) por execFile(bin, [args]); shell só com args posicionais.
// Hostname (RFC 1123) ou IPv4 — sem espaços nem metacaracteres de shell.
const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;

function hostValido(host: string): boolean {
  return host.length <= 253 && HOST_RE.test(host);
}

function portaValida(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

async function checkHttp(url: string, timeout: number): Promise<{ status: string; responseTime: number; message: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout * 1000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const responseTime = Date.now() - start;
    return {
      status: res.ok ? "up" : "degraded",
      responseTime,
      message: `HTTP ${res.status}`,
    };
  } catch {
    return { status: "down", responseTime: Date.now() - start, message: "Connection failed" };
  }
}


    export async function checkTcp(host: string, port: number, timeout: number): Promise<{ status: string; responseTime: number; message: string }> {
  const start = Date.now();
  if (!hostValido(host) || !portaValida(port)) {
    return { status: "down", responseTime: 0, message: "Alvo inválido" };
  }
  try {
    // host/port validados e passados como argumentos posicionais ($0/$1), nunca interpolados
    await execFileAsync(
      "timeout",
      [String(timeout), "bash", "-c", 'echo > "/dev/tcp/$0/$1"', host, String(port)],
      { timeout: timeout * 1000 }
    );
    return { status: "up", responseTime: Date.now() - start, message: `TCP ${host}:${port} open` };
  } catch {
    return { status: "down", responseTime: Date.now() - start, message: `TCP ${host}:${port} closed` };
  }
}

export async function checkPing(host: string, timeout: number): Promise<{ status: string; responseTime: number; message: string }> {
  const start = Date.now();
  if (!hostValido(host)) {
    return { status: "down", responseTime: 0, message: "Alvo inválido" };
  }
  try {
    const { stdout } = await execFileAsync(
      "ping",
      ["-c", "1", "-W", String(timeout), host],
      { timeout: timeout * 1000 }
    );
    const match = String(stdout).match(/time=(\d+\.?\d*)/);
    const responseTime = match ? parseFloat(match[1]) : Date.now() - start;
    return { status: "up", responseTime: Math.round(responseTime), message: `Ping ${responseTime}ms` };
  } catch {
    return { status: "down", responseTime: Date.now() - start, message: "Ping failed" };
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = await prisma.statusPage.findUnique({
    where: { id: params.id },
    include: { monitors: true },
  });

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = [];

  for (const monitor of page.monitors) {
    let result: { status: string; responseTime: number; message: string };

    switch (monitor.type) {
      case "http":
      case "https":
        result = await checkHttp(monitor.target, monitor.timeout);
        break;
      case "tcp": {
        const [host, port] = monitor.target.split(":");
        result = await checkTcp(host, parseInt(port) || 80, monitor.timeout);
        break;
      }
      case "ping":
        result = await checkPing(monitor.target, monitor.timeout);
        break;
      default:
        result = { status: "unknown", responseTime: 0, message: "Tipo desconhecido" };
    }

    await prisma.statusCheck.create({
      data: {
        status: result.status,
        responseTime: result.responseTime,
        message: result.message,
        monitorId: monitor.id,
      },
    });

    // Calculate 24h uptime
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChecks = await prisma.statusCheck.findMany({
      where: { monitorId: monitor.id, createdAt: { gte: last24h } },
    });
    const upChecks = recentChecks.filter((c) => c.status === "up").length;
    const uptime24h = recentChecks.length > 0 ? Math.round((upChecks / recentChecks.length) * 100 * 10) / 10 : 100;

    await prisma.statusMonitor.update({
      where: { id: monitor.id },
      data: {
        status: result.status,
        lastCheck: new Date(),
        lastResponse: result.responseTime,
        uptime24h,
      },
    });

    results.push({ monitor: monitor.name, ...result });
  }

  return NextResponse.json({ checked: results.length, results });
}
