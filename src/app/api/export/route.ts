import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [projects, variables, teams, statusPages, clusters, scalingRules, pipelines, dynamicDns, buildJobs, appTemplates] = await Promise.all([
      prisma.project.findMany(),
      prisma.variable.findMany(),
      prisma.team.findMany(),
      prisma.statusPage.findMany(),
      prisma.cluster.findMany(),
      prisma.scalingRule.findMany(),
      prisma.pipeline.findMany(),
      prisma.dynamicDns.findMany(),
      prisma.buildJob.findMany(),
      prisma.appTemplate.findMany(),
    ]);

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      panel: "CoreByte Panel",
      data: {
        projects,
        variables,
        teams,
        statusPages,
        clusters,
        scalingRules,
        pipelines,
        dynamicDns,
        buildJobs,
        appTemplates,
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="corebyte-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
  }
}
