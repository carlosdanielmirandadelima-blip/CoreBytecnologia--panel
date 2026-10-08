import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertBackupSource, assertString, ValidationError } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { nextRunFromCron, validateCron } from "@/lib/cron";

/**
 * Agendamentos de backup.
 * As origens passam pela allow-list de formato e o cron é validado.
 */

const BACKUP_TYPES = ["volume", "container", "file"];

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const schedules = await prisma.backupSchedule.findMany({
    orderBy: { createdAt: "desc" },
    include: { backups: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      source?: string;
      cron?: string;
      retention?: number;
      cloudDestination?: string;
    };

    const type = BACKUP_TYPES.includes(String(body.type)) ? String(body.type) : "volume";
    const name = assertString(body.name, "nome", 120, true);
    const source = assertBackupSource(body.source, type);

    const cron = String(body.cron || "0 2 * * *").trim();
    if (!validateCron(cron)) {
      return NextResponse.json(
        { error: 'Expressão de horário inválida. Use o formato cron de 5 campos, ex.: "0 2 * * *".' },
        { status: 400 }
      );
    }

    const retentionNum = Number(body.retention ?? 7);
    const retention = Number.isInteger(retentionNum) && retentionNum >= 1 && retentionNum <= 365 ? retentionNum : 7;

    const schedule = await prisma.backupSchedule.create({
      data: {
        name,
        type,
        source,
        cron,
        retention,
        cloudDestination: assertString(body.cloudDestination, "destino", 60),
        nextRun: nextRunFromCron(cron),
      },
    });

    await writeAudit(req, {
      action: "backup-schedule.create",
      resource: "backup-schedule",
      resourceId: schedule.id,
      details: `Agendamento "${name}" criado (${type}: ${source}, cron: ${cron})`,
      user,
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : "Erro ao criar agendamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
