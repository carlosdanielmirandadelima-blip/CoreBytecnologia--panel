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
    const updated = await prisma.scalingRule.update({
      where: { id: params.id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.threshold !== undefined && { threshold: body.threshold }),
        ...(body.minReplicas !== undefined && { minReplicas: body.minReplicas }),
        ...(body.maxReplicas !== undefined && { maxReplicas: body.maxReplicas }),
        ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.scalingRule.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
