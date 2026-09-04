import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), "backups");

// Nome de volume/container Docker: começa alfanumérico, segue com [\w.-]
const DOCKER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
// Caminho absoluto sem metacaracteres de shell nem retrocesso
const SAFE_PATH_RE = /^\/[A-Za-z0-9_\/.-]*$/;

function validarEntrada(name: string, type: string, source: string): string | null {
  if (!/^[A-Za-z0-9 _.-]+$/.test(name) || name.includes("..")) {
    return "Nome inválido";
  }
  if (type === "path") {
    if (!SAFE_PATH_RE.test(source) || source.includes("..")) return "Caminho inválido";
  } else if (!DOCKER_NAME_RE.test(source)) {
    return "Source inválido";
  }
  return null;
}

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

    const erro = validarEntrada(String(name), String(type || "volume"), String(source));
    if (erro) {
      return NextResponse.json({ error: erro }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${name.replace(/\s+/g, "-").toLowerCase()}_${timestamp}.tar.gz`;
    const filePath = path.resolve(BACKUP_DIR, fileName);
    if (!filePath.startsWith(BACKUP_DIR + path.sep)) {
      return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    }

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
          await execFileAsync("docker", [
            "run", "--rm",
            "-v", `${source}:/data`,
            "-v", `${BACKUP_DIR}:/backup`,
            "alpine", "tar", "czf", `/backup/${fileName}`, "-C", "/data", ".",
          ]);
        } else if (type === "container") {
          // pipe exige shell; entradas já validadas e passadas como argumentos posicionais
          await execFileAsync("bash", ["-c", 'docker export "$0" | gzip > "$1"', source, filePath]);
        } else {
          await execFileAsync("tar", ["czf", filePath, source]);
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
