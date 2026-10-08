import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/**
 * Exportação completa da configuração do painel.
 *
 * Bug corrigido: a versão anterior chamava `prisma.variable.findMany()`, mas
 * o model `Variable` não existe no schema — a exportação quebrava com 500
 * sempre que era usada. Também não incluía os dados mais recentes
 * (backups, provedores de nuvem, monitores, notificações).
 *
 * Restrito ao administrador: o arquivo contém toda a configuração do servidor.
 */
export async function GET() {
  const { user, error } = await requireAdmin();
  if (error) return error;

  try {
    const [
      projects,
      globalEnvVars,
      teams,
      statusPages,
      clusters,
      scalingRules,
      pipelines,
      dynamicDns,
      buildJobs,
      appTemplates,
      backupSchedules,
      cloudProviders,
      notifications,
      shortcuts,
      nodes,
      dnsRecords,
    ] = await Promise.all([
      prisma.project.findMany({ include: { services: true, envVars: true } }),
      prisma.globalEnvVar.findMany(),
      prisma.team.findMany({ include: { members: true } }),
      prisma.statusPage.findMany({ include: { monitors: true } }),
      prisma.cluster.findMany(),
      prisma.scalingRule.findMany(),
      prisma.pipeline.findMany({ include: { stages: true } }),
      prisma.dynamicDns.findMany(),
      prisma.buildJob.findMany(),
      prisma.appTemplate.findMany(),
      prisma.backupSchedule.findMany(),
      // Credenciais são exportadas já cifradas (campo `config`).
      prisma.cloudProvider.findMany(),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.shortcut.findMany(),
      prisma.node.findMany(),
      prisma.dnsRecord.findMany(),
    ]);

    const exportData = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      panel: "CoreByte Panel",
      note: "As credenciais de nuvem estão cifradas e só podem ser lidas pelo painel que as criou (mesmo APP_SECRET).",
      data: {
        projects,
        globalEnvVars,
        teams,
        statusPages,
        clusters,
        scalingRules,
        pipelines,
        dynamicDns,
        buildJobs,
        appTemplates,
        backupSchedules,
        cloudProviders,
        notifications,
        shortcuts,
        nodes,
        dnsRecords,
      },
    };

    await writeAudit(null, {
      action: "panel.export",
      resource: "panel",
      details: "Exportação da configuração do painel",
      user,
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="corebyte-export-${new Date().toISOString().split("T")[0]}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao exportar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
