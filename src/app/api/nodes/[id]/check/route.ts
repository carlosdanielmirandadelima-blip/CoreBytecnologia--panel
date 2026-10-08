import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Docker from "dockerode";
import os from "os";
import fs from "fs";
import { writeAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "nodes.post", resource: "nodes", details: `Operação post em nodes` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const node = await prisma.node.findUnique({ where: { id: params.id } });
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    let docker: Docker;

    if (node.isLocal) {
      docker = new Docker({ socketPath: "/var/run/docker.sock" });
    } else {
      const opts: Docker.DockerOptions = {
        host: node.host,
        port: node.port,
        protocol: node.protocol as "http" | "https",
      };

      if (node.protocol === "https" && node.tlsCa) {
        opts.ca = node.tlsCa;
        opts.cert = node.tlsCert;
        opts.key = node.tlsKey;
      }

      docker = new Docker(opts);
    }

    const info = await docker.info();
    const containers = await docker.listContainers({ all: true });

    let cpuPercent = 0;
    let memoryPercent = 0;
    let diskPercent = 0;

    if (node.isLocal) {
      const cpus = os.cpus();
      const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      const totalTick = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);
      cpuPercent = Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      memoryPercent = Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10;

      try {
        const diskData = fs.readFileSync("/proc/mounts", "utf8");
        const rootMount = diskData.split("\n").find((l) => l.includes(" / "));
        if (rootMount) {
          // execFile com argumentos separados (sem shell, sem injeção).
          const { execFile } = await import("child_process");
          const { promisify } = await import("util");
          const run = promisify(execFile);
          const { stdout } = await run("df", ["-P", "/"]);
          const line = stdout.trim().split("\n").pop() || "";
          const parts = line.split(/\s+/);
          diskPercent = Number(String(parts[4] ?? "0").replace("%", "")) || 0;
        }
      } catch {
        // fallback
      }
    }

    const updated = await prisma.node.update({
      where: { id: params.id },
      data: {
        status: "online",
        containers: containers.length,
        cpuPercent,
        memoryPercent,
        diskPercent,
        lastCheck: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      dockerVersion: info.ServerVersion,
      os: info.OperatingSystem,
      totalMemory: info.MemTotal,
      cpuCount: info.NCPU,
    });
  } catch {
    const updated = await prisma.node.update({
      where: { id: params.id },
      data: { status: "offline", lastCheck: new Date() },
    });
    return NextResponse.json(updated);
  }
}
