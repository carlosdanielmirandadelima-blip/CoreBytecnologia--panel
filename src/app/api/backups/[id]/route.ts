import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backup = await prisma.backup.findUnique({
    where: { id: params.id },
    include: { schedule: true },
  });

  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(backup);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backup = await prisma.backup.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fs.existsSync(backup.filePath)) {
    fs.unlinkSync(backup.filePath);
  }

  await prisma.backup.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
