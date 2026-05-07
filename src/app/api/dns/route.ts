import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCloudflareToken(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "cloudflare_api_token" } });
  return setting?.value || null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const zoneId = req.nextUrl.searchParams.get("zoneId");
  const token = await getCloudflareToken();

  if (!token) return NextResponse.json({ error: "Token Cloudflare não configurado" }, { status: 400 });
  if (!zoneId) return NextResponse.json({ error: "zoneId é obrigatório" }, { status: 400 });

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ error: data.errors?.[0]?.message || "Erro" }, { status: 400 });

    return NextResponse.json(data.result);
  } catch {
    return NextResponse.json({ error: "Erro ao listar registros DNS" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getCloudflareToken();
  if (!token) return NextResponse.json({ error: "Token Cloudflare não configurado" }, { status: 400 });

  try {
    const body = await req.json();
    const { zoneId, zoneName, type, name, content, proxied, ttl } = body;

    if (!zoneId || !type || !name || !content) {
      return NextResponse.json({ error: "Campos obrigatórios: zoneId, type, name, content" }, { status: 400 });
    }

    const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, content, proxied: proxied ?? true, ttl: ttl || 1 }),
    });
    const cfData = await cfRes.json();

    if (!cfData.success) {
      return NextResponse.json({ error: cfData.errors?.[0]?.message || "Erro ao criar registro" }, { status: 400 });
    }

    await prisma.dnsRecord.create({
      data: {
        zoneId,
        zoneName: zoneName || "",
        recordId: cfData.result.id,
        type,
        name,
        content,
        proxied: proxied ?? true,
        ttl: ttl || 1,
      },
    });

    return NextResponse.json(cfData.result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar registro DNS" }, { status: 500 });
  }
}
