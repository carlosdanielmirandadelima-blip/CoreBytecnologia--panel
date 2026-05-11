import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const containers = await docker.listContainers({ all: false });
    const statsPromises = containers.map(async (containerInfo) => {
      try {
        const container = docker.getContainer(containerInfo.Id);
        const stats = await container.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
        const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
        const numCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

        const memUsage = stats.memory_stats?.usage || 0;
        const memLimit = stats.memory_stats?.limit || 1;
        const memPercent = (memUsage / memLimit) * 100;

        const networks = stats.networks || {};
        let rxBytes = 0;
        let txBytes = 0;
        for (const net of Object.values(networks) as Array<{ rx_bytes: number; tx_bytes: number }>) {
          rxBytes += net.rx_bytes || 0;
          txBytes += net.tx_bytes || 0;
        }

        return {
          id: containerInfo.Id.substring(0, 12),
          name: containerInfo.Names[0]?.replace("/", "") || "unknown",
          image: containerInfo.Image,
          state: containerInfo.State,
          status: containerInfo.Status,
          cpu: Math.round(cpuPercent * 100) / 100,
          memory: {
            usage: memUsage,
            limit: memLimit,
            percent: Math.round(memPercent * 100) / 100,
          },
          network: { rxBytes, txBytes },
          health: containerInfo.Status?.includes("healthy")
            ? "healthy"
            : containerInfo.Status?.includes("unhealthy")
            ? "unhealthy"
            : "none",
        };
      } catch {
        return {
          id: containerInfo.Id.substring(0, 12),
          name: containerInfo.Names[0]?.replace("/", "") || "unknown",
          image: containerInfo.Image,
          state: containerInfo.State,
          status: containerInfo.Status,
          cpu: 0,
          memory: { usage: 0, limit: 0, percent: 0 },
          network: { rxBytes: 0, txBytes: 0 },
          health: "none",
        };
      }
    });

    const allStats = await Promise.all(statsPromises);
    return NextResponse.json(allStats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao obter stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
