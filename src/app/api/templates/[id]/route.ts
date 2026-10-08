import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "templates.delete", resource: "templates", details: `Operação delete em templates` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.appTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "templates.patch", resource: "templates", details: `Operação patch em templates` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await prisma.appTemplate.findUnique({ where: { id: params.id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.appTemplate.update({
    where: { id: params.id },
    data: { downloads: template.downloads + 1 },
  });

  return NextResponse.json({ success: true });
}
