import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import os from "os";

export async function GET(req: NextRequest) {
  // Exige permissão de leitura de verdade (antes o campo era ignorado).
  const { error } = await requireApiKey(req, "read");
  if (error) return error;

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return NextResponse.json({
    data: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || "",
      totalMemory: totalMem,
      freeMemory: freeMem,
      usedMemory: totalMem - freeMem,
      memoryPercent: Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10,
      loadAverage: os.loadavg(),
    },
  });
}
