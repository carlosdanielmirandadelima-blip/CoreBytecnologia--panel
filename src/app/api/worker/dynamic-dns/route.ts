import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkerRequest } from "@/lib/worker-auth";
import { requireSession } from "@/lib/session";
import { updateDnsRecord } from "@/lib/dns";
import { assertHost } from "@/lib/validate";

/**
 * Atualiza um registro de Dynamic DNS quando o IP público muda.
 * Chamado pelo worker.
 */
export async function POST(req: NextRequest) {
  const fromWorker = await isWorkerRequest(req);
  if (!fromWorker) {
    const { error } = await requireSession();
    if (error) return error;
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; ip?: string };
  const id = String(body.id || "");
  const ip = String(body.ip || "");

  if (!id || !ip) return NextResponse.json({ error: "Informe id e ip" }, { status: 400 });
  try {
    assertHost(ip, "endereço IP");
  } catch {
    return NextResponse.json({ error: "Endereço IP inválido" }, { status: 400 });
  }

  const entry = await prisma.dynamicDns.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  // Nada a fazer quando o IP não mudou.
  if (entry.currentIp === ip) {
    await prisma.dynamicDns.update({ where: { id }, data: { lastCheck: new Date() } });
    return NextResponse.json({ ok: true, changed: false, ip });
  }

  try {
    await updateDnsRecord(entry.provider, {
      zoneId: entry.zoneId,
      recordId: entry.recordId,
      hostname: entry.hostname,
      type: entry.type,
      token: entry.token,
      content: ip,
    });

    await prisma.dynamicDns.update({
      where: { id },
      data: { lastIp: entry.currentIp, currentIp: ip, lastUpdate: new Date(), lastCheck: new Date() },
    });

    return NextResponse.json({ ok: true, changed: true, ip });
  } catch (e) {
    await prisma.dynamicDns.update({ where: { id }, data: { lastCheck: new Date() } });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar o DNS" },
      { status: 500 }
    );
  }
}
