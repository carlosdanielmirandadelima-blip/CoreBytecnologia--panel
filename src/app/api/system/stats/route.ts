import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import os from "os";
import { execSync } from "child_process";

function getDiskUsage() {
  try {
    const output = execSync("df -B1 / | tail -1").toString().trim();
    const parts = output.split(/\s+/);
    return {
      total: parseInt(parts[1]) || 0,
      used: parseInt(parts[2]) || 0,
      free: parseInt(parts[3]) || 0,
      percent: parseInt(parts[4]) || 0,
    };
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0 };
  }
}

function getNetworkStats() {
  try {
    const output = execSync("cat /proc/net/dev").toString();
    const lines = output.split("\n").slice(2);
    let rxBytes = 0;
    let txBytes = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 10 && !parts[0].startsWith("lo:")) {
        rxBytes += parseInt(parts[1]) || 0;
        txBytes += parseInt(parts[9]) || 0;
      }
    }
    return { rxBytes, txBytes };
  } catch {
    return { rxBytes: 0, txBytes: 0 };
  }
}

function getLoadAvg() {
  const load = os.loadavg();
  return { load1: load[0], load5: load[1], load15: load[2] };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const disk = getDiskUsage();
  const network = getNetworkStats();
  const load = getLoadAvg();
  const uptime = os.uptime();

  let cpuPercent = 0;
  for (const cpu of cpus) {
    const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    const idle = cpu.times.idle;
    cpuPercent += ((total - idle) / total) * 100;
  }
  cpuPercent = cpuPercent / cpus.length;

  return NextResponse.json({
    timestamp: Date.now(),
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || "Unknown",
      percent: Math.round(cpuPercent * 10) / 10,
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 1000) / 10,
    },
    disk,
    network,
    load,
    uptime,
    platform: os.platform(),
    hostname: os.hostname(),
    release: os.release(),
  });
}
