import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.dynamicDns.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { hostname, type, provider, zoneId, recordId, token, interval } = body;

    if (!hostname) return NextResponse.json({ error: "Hostname é obrigatório" }, { status: 400 });

    let currentIp = "";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      currentIp = ipData.ip || "";
    } catch { /* silent */ }

    const record = await prisma.dynamicDns.create({
      data: {
        hostname,
        type: type || "A",
        provider: provider || "cloudflare",
        zoneId: zoneId || "",
        recordId: recordId || "",
        token: token || "",
        interval: interval || 300,
        currentIp,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar registro DDNS" }, { status: 500 });
  }
}
