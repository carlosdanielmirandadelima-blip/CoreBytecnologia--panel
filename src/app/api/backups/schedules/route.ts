import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getNextRun(cron: string): Date {
  const now = new Date();
  const parts = cron.split(" ");
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 2;
  
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schedules = await prisma.backupSchedule.findMany({
    orderBy: { createdAt: "desc" },
    include: { backups: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, source, cron, retention } = body;

    if (!name || !source) {
      return NextResponse.json({ error: "Nome e source são obrigatórios" }, { status: 400 });
    }

    const cronStr = cron || "0 2 * * *";
    const nextRun = getNextRun(cronStr);

    const schedule = await prisma.backupSchedule.create({
      data: {
        name,
        type: type || "volume",
        source,
        cron: cronStr,
        retention: retention || 7,
        nextRun,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }
}
