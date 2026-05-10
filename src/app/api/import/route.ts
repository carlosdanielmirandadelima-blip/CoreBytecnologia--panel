import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.data || body.panel !== "CoreByte Panel") {
      return NextResponse.json({ error: "Arquivo de exportação inválido" }, { status: 400 });
    }

    const results: Record<string, number> = {};

    if (body.data.variables?.length) {
      for (const v of body.data.variables) {
        await prisma.variable.upsert({
          where: { id: v.id },
          create: { id: v.id, key: v.key, value: v.value, description: v.description || "" },
          update: { key: v.key, value: v.value },
        });
      }
      results.variables = body.data.variables.length;
    }

    if (body.data.dynamicDns?.length) {
      for (const d of body.data.dynamicDns) {
        await prisma.dynamicDns.upsert({
          where: { id: d.id },
          create: { id: d.id, hostname: d.hostname, type: d.type, provider: d.provider, zoneId: d.zoneId || "", recordId: d.recordId || "", token: d.token || "", interval: d.interval || 300 },
          update: { hostname: d.hostname },
        });
      }
      results.dynamicDns = body.data.dynamicDns.length;
    }

    return NextResponse.json({ success: true, imported: results });
  } catch {
    return NextResponse.json({ error: "Erro ao importar" }, { status: 500 });
  }
}
