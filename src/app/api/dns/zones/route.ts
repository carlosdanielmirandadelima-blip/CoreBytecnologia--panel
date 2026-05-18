import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCloudflareToken(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "cloudflare_api_token" } });
  return setting?.value || null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getCloudflareToken();
  if (!token) return NextResponse.json({ error: "Token Cloudflare não configurado. Vá em Configurações > Integrações.", notConfigured: true }, { status: 200 });

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ error: data.errors?.[0]?.message || "Erro na API Cloudflare" }, { status: 400 });

    return NextResponse.json(data.result.map((z: Record<string, unknown>) => ({
      id: z.id,
      name: z.name,
      status: z.status,
      nameServers: z.name_servers,
    })));
  } catch {
    return NextResponse.json({ error: "Erro ao consultar Cloudflare" }, { status: 500 });
  }
}
