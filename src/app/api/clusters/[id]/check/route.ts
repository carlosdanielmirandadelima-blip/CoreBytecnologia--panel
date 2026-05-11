import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cluster = await prisma.cluster.findUnique({ where: { id: params.id } });
  if (!cluster) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    if (!cluster.endpoint) {
      await prisma.cluster.update({
        where: { id: params.id },
        data: { status: "disconnected", lastCheck: new Date() },
      });
      return NextResponse.json({ status: "disconnected", message: "Endpoint não configurado" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = `${cluster.endpoint}/api/v1/nodes`;
      const headers: Record<string, string> = {};
      if (cluster.token) headers["Authorization"] = `Bearer ${cluster.token}`;

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        ...(cluster.endpoint.startsWith("https") ? {} : {}),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const nodeCount = data.items?.length || 0;

        const podsRes = await fetch(`${cluster.endpoint}/api/v1/pods`, { headers }).catch(() => null);
        const podsData = podsRes?.ok ? await podsRes.json() : { items: [] };
        const podCount = podsData.items?.length || 0;

        const svcRes = await fetch(`${cluster.endpoint}/api/v1/services`, { headers }).catch(() => null);
        const svcData = svcRes?.ok ? await svcRes.json() : { items: [] };
        const svcCount = svcData.items?.length || 0;

        await prisma.cluster.update({
          where: { id: params.id },
          data: {
            status: "connected",
            nodes: nodeCount,
            pods: podCount,
            services: svcCount,
            lastCheck: new Date(),
          },
        });

        return NextResponse.json({ status: "connected", nodes: nodeCount, pods: podCount, services: svcCount });
      } else {
        await prisma.cluster.update({
          where: { id: params.id },
          data: { status: "error", lastCheck: new Date() },
        });
        return NextResponse.json({ status: "error", message: `HTTP ${res.status}` });
      }
    } catch {
      clearTimeout(timeout);
      await prisma.cluster.update({
        where: { id: params.id },
        data: { status: "disconnected", lastCheck: new Date() },
      });
      return NextResponse.json({ status: "disconnected", message: "Não foi possível conectar" });
    }
  } catch {
    return NextResponse.json({ error: "Erro ao verificar cluster" }, { status: 500 });
  }
}
