import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), "backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

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

export async function POST() {
  try {
    const now = new Date();
    const schedules = await prisma.backupSchedule.findMany({
      where: {
        enabled: true,
        nextRun: { lte: now },
      },
      include: { backups: { orderBy: { createdAt: "desc" } } },
    });

    const results = [];

    for (const schedule of schedules) {
      const timestamp = now.toISOString().replace(/[:.]/g, "-");
      const fileName = `${schedule.name.replace(/\s+/g, "-").toLowerCase()}_scheduled_${timestamp}.tar.gz`;
      const filePath = path.join(BACKUP_DIR, fileName);

      const backup = await prisma.backup.create({
        data: {
          name: `${schedule.name} (auto)`,
          type: schedule.type,
          source: schedule.source,
          fileName,
          filePath,
          status: "running",
          scheduleId: schedule.id,
        },
      });

      try {
        if (schedule.type === "volume") {
          await execAsync(
            `docker run --rm -v ${schedule.source}:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/${fileName} -C /data .`
          );
        } else {
          await execAsync(`tar czf ${filePath} ${schedule.source}`);
        }

        const stats = fs.statSync(filePath);
        await prisma.backup.update({
          where: { id: backup.id },
          data: { status: "completed", fileSize: stats.size },
        });
      } catch {
        await prisma.backup.update({
          where: { id: backup.id },
          data: { status: "failed" },
        });
      }

      // Cleanup old backups beyond retention
      const allBackups = await prisma.backup.findMany({
        where: { scheduleId: schedule.id, status: "completed" },
        orderBy: { createdAt: "desc" },
      });

      if (allBackups.length > schedule.retention) {
        const toDelete = allBackups.slice(schedule.retention);
        for (const old of toDelete) {
          if (fs.existsSync(old.filePath)) fs.unlinkSync(old.filePath);
          await prisma.backup.delete({ where: { id: old.id } });
        }
      }

      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { lastRun: now, nextRun: getNextRun(schedule.cron) },
      });

      results.push({ schedule: schedule.name, backup: backup.id });
    }

    return NextResponse.json({ executed: results.length, results });
  } catch {
    return NextResponse.json({ error: "Erro ao executar backups" }, { status: 500 });
  }
}
