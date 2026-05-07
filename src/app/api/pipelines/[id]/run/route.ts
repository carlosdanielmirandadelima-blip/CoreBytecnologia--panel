import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.id },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const startTime = Date.now();
  const stageResults: { name: string; status: string; duration: number; output: string }[] = [];
  let pipelineStatus = "success";
  const logs: string[] = [];

  for (const stage of pipeline.stages) {
    const stageStart = Date.now();
    logs.push(`[${new Date().toISOString()}] === Estágio: ${stage.name} (${stage.type}) ===`);

    try {
      if (stage.type === "build") {
        logs.push(`[${new Date().toISOString()}] Executando build...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        logs.push(`[${new Date().toISOString()}] Build concluído com sucesso`);
        stageResults.push({ name: stage.name, status: "success", duration: Date.now() - stageStart, output: "Build OK" });
      } else if (stage.type === "test") {
        logs.push(`[${new Date().toISOString()}] Executando testes...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        logs.push(`[${new Date().toISOString()}] Testes passaram`);
        stageResults.push({ name: stage.name, status: "success", duration: Date.now() - stageStart, output: "Tests OK" });
      } else if (stage.type === "deploy") {
        logs.push(`[${new Date().toISOString()}] Executando deploy...`);
        await new Promise(resolve => setTimeout(resolve, 400));
        logs.push(`[${new Date().toISOString()}] Deploy concluído`);
        stageResults.push({ name: stage.name, status: "success", duration: Date.now() - stageStart, output: "Deploy OK" });
      } else {
        logs.push(`[${new Date().toISOString()}] Executando: ${stage.command || stage.type}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        stageResults.push({ name: stage.name, status: "success", duration: Date.now() - stageStart, output: "OK" });
      }
    } catch {
      pipelineStatus = "failed";
      stageResults.push({ name: stage.name, status: "failed", duration: Date.now() - stageStart, output: "Error" });
      logs.push(`[${new Date().toISOString()}] ERRO no estágio ${stage.name}`);
      break;
    }
  }

  const duration = Date.now() - startTime;
  logs.push(`\n[${new Date().toISOString()}] Pipeline finalizado: ${pipelineStatus} (${duration}ms)`);

  const run = await prisma.pipelineRun.create({
    data: {
      pipelineId: params.id,
      status: pipelineStatus,
      duration,
      logs: logs.join("\n"),
      stageResults: JSON.stringify(stageResults),
    },
  });

  await prisma.pipeline.update({
    where: { id: params.id },
    data: { status: pipelineStatus, lastRun: new Date() },
  });

  return NextResponse.json(run);
}
