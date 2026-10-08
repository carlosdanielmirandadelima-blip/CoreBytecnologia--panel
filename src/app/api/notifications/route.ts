import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = await prisma.notification.count({ where: { read: false } });

  return NextResponse.json({ notifications, unread });
}

export async function POST(req: NextRequest) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "notifications.post", resource: "notifications", details: `Operação post em notifications` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, message, type } = body;

    if (!title) return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });

    const notification = await prisma.notification.create({
      data: {
        title,
        message: message || "",
        type: type || "info",
        userId: (session.user as { id?: string })?.id || "",
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}

export async function PATCH() {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "notifications.patch", resource: "notifications", details: `Operação patch em notifications` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
