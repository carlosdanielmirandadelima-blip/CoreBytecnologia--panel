import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCloudflareToken(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "cloudflare_api_token" } });
  return setting?.value || null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getCloudflareToken();
  if (!token) return NextResponse.json({ error: "Token não configurado" }, { status: 400 });

  try {
    const body = await req.json();
    const { zoneId, type, name, content, proxied, ttl } = body;

    const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${params.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, content, proxied, ttl }),
    });
    const cfData = await cfRes.json();

    if (!cfData.success) {
      return NextResponse.json({ error: cfData.errors?.[0]?.message || "Erro" }, { status: 400 });
    }

    return NextResponse.json(cfData.result);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getCloudflareToken();
  if (!token) return NextResponse.json({ error: "Token não configurado" }, { status: 400 });

  const zoneId = req.nextUrl.searchParams.get("zoneId");
  if (!zoneId) return NextResponse.json({ error: "zoneId obrigatório" }, { status: 400 });

  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    await prisma.dnsRecord.deleteMany({ where: { recordId: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
