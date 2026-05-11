import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import os from "os";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

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
