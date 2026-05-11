import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
    include: { schedule: true },
  });

  return NextResponse.json(backups);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, source } = body;

    if (!name || !source) {
      return NextResponse.json({ error: "Nome e source são obrigatórios" }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${name.replace(/\s+/g, "-").toLowerCase()}_${timestamp}.tar.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    const backup = await prisma.backup.create({
      data: {
        name,
        type: type || "volume",
        source,
        fileName,
        filePath,
        status: "running",
      },
    });

    (async () => {
      try {
        if (type === "volume") {
          await execAsync(
            `docker run --rm -v ${source}:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/${fileName} -C /data .`
          );
        } else if (type === "container") {
          await execAsync(`docker export ${source} | gzip > ${filePath}`);
        } else {
          await execAsync(`tar czf ${filePath} ${source}`);
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
    })();

    return NextResponse.json(backup, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar backup" }, { status: 500 });
  }
}
