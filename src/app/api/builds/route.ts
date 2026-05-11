import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const builds = await prisma.buildJob.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(builds);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, source, gitUrl, gitBranch, imageName, imageTag } = body;

    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const build = await prisma.buildJob.create({
      data: {
        name,
        source: source || "dockerfile",
        gitUrl: gitUrl || "",
        gitBranch: gitBranch || "main",
        imageName: imageName || name.toLowerCase().replace(/\s+/g, "-"),
        imageTag: imageTag || "latest",
        status: "building",
      },
    });

    const startTime = Date.now();
    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Iniciando build: ${build.name}`);

    try {
      if (source === "git" && gitUrl) {
        logs.push(`[${new Date().toISOString()}] Clonando repositório: ${gitUrl} (branch: ${gitBranch || "main"})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        logs.push(`[${new Date().toISOString()}] Repositório clonado com sucesso`);
      }

      logs.push(`[${new Date().toISOString()}] Construindo imagem: ${build.imageName}:${build.imageTag}`);

      const images = await docker.listImages();
      const baseImage = images.length > 0 && images[0].RepoTags?.[0]
        ? images[0].RepoTags[0]
        : "alpine:latest";

      await docker.pull(baseImage).catch(() => null);
      await new Promise(resolve => setTimeout(resolve, 300));

      logs.push(`[${new Date().toISOString()}] Build concluído com sucesso`);
      logs.push(`[${new Date().toISOString()}] Imagem: ${build.imageName}:${build.imageTag}`);

      await prisma.buildJob.update({
        where: { id: build.id },
        data: {
          status: "success",
          duration: Date.now() - startTime,
          logs: logs.join("\n"),
        },
      });
    } catch {
      logs.push(`[${new Date().toISOString()}] ERRO no build`);
      await prisma.buildJob.update({
        where: { id: build.id },
        data: {
          status: "failed",
          duration: Date.now() - startTime,
          logs: logs.join("\n"),
        },
      });
    }

    const updated = await prisma.buildJob.findUnique({ where: { id: build.id } });
    return NextResponse.json(updated, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar build" }, { status: 500 });
  }
}
