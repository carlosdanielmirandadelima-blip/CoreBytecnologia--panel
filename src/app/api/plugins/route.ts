import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLUGINS = [
  { name: "auto-ssl", displayName: "Auto SSL", description: "Certificados SSL automáticos via Let's Encrypt", icon: "shield", version: "1.0.0" },
  { name: "log-aggregator", displayName: "Log Aggregator", description: "Agregação centralizada de logs de todos os containers", icon: "file-text", version: "1.0.0" },
  { name: "auto-update", displayName: "Auto Update", description: "Atualização automática de imagens Docker", icon: "refresh-cw", version: "1.0.0" },
  { name: "webhook-notifier", displayName: "Webhook Notifier", description: "Notificações via webhook para eventos do painel", icon: "bell", version: "1.0.0" },
  { name: "resource-limiter", displayName: "Resource Limiter", description: "Limites de CPU e memória por container", icon: "cpu", version: "1.0.0" },
  { name: "cron-manager", displayName: "Cron Manager", description: "Gerenciamento visual de cron jobs dentro dos containers", icon: "clock", version: "1.0.0" },
  { name: "ip-whitelist", displayName: "IP Whitelist", description: "Lista branca de IPs para acesso ao painel", icon: "lock", version: "1.0.0" },
  { name: "smtp-relay", displayName: "SMTP Relay", description: "Configuração de relay SMTP para envio de emails", icon: "mail", version: "1.0.0" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existingPlugins = await prisma.plugin.findMany({ orderBy: { name: "asc" } });

  if (existingPlugins.length === 0) {
    for (const p of DEFAULT_PLUGINS) {
      await prisma.plugin.create({ data: p });
    }
    const plugins = await prisma.plugin.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(plugins);
  }

  return NextResponse.json(existingPlugins);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, displayName, description, version, icon } = body;

    if (!name || !displayName) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const plugin = await prisma.plugin.create({
      data: { name, displayName, description: description || "", version: version || "1.0.0", icon: icon || "puzzle" },
    });

    return NextResponse.json(plugin, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar plugin" }, { status: 500 });
  }
}
