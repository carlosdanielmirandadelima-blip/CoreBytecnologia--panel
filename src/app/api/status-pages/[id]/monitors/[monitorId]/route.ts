import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; monitorId: string } }
) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "status-pages.delete", resource: "status-pages", details: `Operação delete em status-pages` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.statusMonitor.delete({ where: { id: params.monitorId } });
  return NextResponse.json({ success: true });
}
