import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const record = await prisma.dynamicDns.update({
      where: { id: params.id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.interval !== undefined && { interval: body.interval }),
        ...(body.hostname && { hostname: body.hostname }),
      },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.dynamicDns.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipRes.json();
    const newIp = ipData.ip || "";

    let updateStatus = "IP atualizado";

    if (record.token && record.zoneId && record.recordId && newIp !== record.currentIp) {
      try {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${record.zoneId}/dns_records/${record.recordId}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${record.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: newIp }),
        });
        updateStatus = "DNS atualizado no Cloudflare";
      } catch {
        updateStatus = "Erro ao atualizar Cloudflare";
      }
    }

    await prisma.dynamicDns.update({
      where: { id: params.id },
      data: {
        lastIp: record.currentIp,
        currentIp: newIp,
        lastCheck: new Date(),
        lastUpdate: newIp !== record.currentIp ? new Date() : record.lastUpdate,
      },
    });

    return NextResponse.json({ ip: newIp, previousIp: record.currentIp, status: updateStatus });
  } catch {
    return NextResponse.json({ error: "Erro ao verificar IP" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.dynamicDns.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
