import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backup = await prisma.backup.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (backup.status !== "completed") {
    return NextResponse.json({ error: "Backup não está completo" }, { status: 400 });
  }

  if (!fs.existsSync(backup.filePath)) {
    return NextResponse.json({ error: "Arquivo de backup não encontrado" }, { status: 404 });
  }

  try {
    if (backup.type === "volume") {
      await execAsync(
        `docker run --rm -v ${backup.source}:/data -v ${backup.filePath}:/backup.tar.gz alpine sh -c "rm -rf /data/* && tar xzf /backup.tar.gz -C /data"`
      );
    } else {
      return NextResponse.json({ error: "Restauração só suportada para volumes" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Backup restaurado com sucesso" });
  } catch {
    return NextResponse.json({ error: "Erro ao restaurar backup" }, { status: 500 });
  }
}
