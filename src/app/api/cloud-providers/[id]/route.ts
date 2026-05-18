import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { id } = params;

    const provider = await prisma.cloudProvider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: "Provider não encontrado" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.accessToken !== undefined) updateData.accessToken = body.accessToken;
    if (body.refreshToken !== undefined) updateData.refreshToken = body.refreshToken;
    if (body.clientId !== undefined) updateData.clientId = body.clientId;
    if (body.clientSecret !== undefined) updateData.clientSecret = body.clientSecret;
    if (body.folder !== undefined) updateData.folder = body.folder;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.autoBackup !== undefined) updateData.autoBackup = body.autoBackup;
    if (body.autoFrequency !== undefined) updateData.autoFrequency = body.autoFrequency;

    const updated = await prisma.cloudProvider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.cloudProvider.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
