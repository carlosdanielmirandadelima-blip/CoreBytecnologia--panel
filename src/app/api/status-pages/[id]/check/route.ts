import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

async function checkTcp(host: string, port: number, timeout: number): Promise<{ status: string; responseTime: number; message: string }> {
  const start = Date.now();
  try {
    await execAsync(`timeout ${timeout} bash -c 'echo > /dev/tcp/${host}/${port}'`, { timeout: timeout * 1000 });
    return { status: "up", responseTime: Date.now() - start, message: `TCP ${host}:${port} open` };
  } catch {
    return { status: "down", responseTime: Date.now() - start, message: `TCP ${host}:${port} closed` };
  }
}

async function checkPing(host: string, timeout: number): Promise<{ status: string; responseTime: number; message: string }> {
  const start = Date.now();
  try {
    const { stdout } = await execAsync(`ping -c 1 -W ${timeout} ${host}`, { timeout: timeout * 1000 });
    const match = stdout.match(/time=(\d+\.?\d*)/);
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
