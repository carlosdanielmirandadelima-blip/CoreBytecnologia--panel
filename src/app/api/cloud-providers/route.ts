import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const providers = await prisma.cloudProvider.findMany({
      orderBy: { createdAt: "desc" },
    });
    // mask tokens
    const safe = providers.map((p) => ({
      ...p,
      accessToken: p.accessToken ? "••••••••" : null,
      refreshToken: p.refreshToken ? "••••••••" : null,
      clientSecret: p.clientSecret ? "••••••••" : null,
    }));
    return NextResponse.json(safe);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, accessToken, refreshToken, clientId, clientSecret, folder, autoBackup, autoFrequency } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Nome e tipo são obrigatórios" }, { status: 400 });
    }

    const validTypes = ["google_drive", "dropbox", "terabox"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const provider = await prisma.cloudProvider.create({
      data: {
        name,
        type,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        folder: folder || "/CoreByte-Backups",
        autoBackup: autoBackup || false,
        autoFrequency: autoFrequency || "daily",
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
