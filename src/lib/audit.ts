import { prisma } from "./prisma";

/**
 * Trilha de auditoria.
 *
 * Antes a página existia mas nada era gravado: não havia como saber quem
 * implantou, parou ou apagou o quê. Toda mutação relevante passa por aqui.
 */

export interface AuditParams {
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
}

/** Extrai o IP real, respeitando o proxy do Traefik. */
export function clientIp(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 60);
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-client-ip") ||
    ""
  ).slice(0, 60);
}

/**
 * Grava um evento de auditoria. Falhas aqui nunca derrubam a operação
 * principal (auditoria é importante, mas não pode quebrar o painel).
 */
export async function writeAudit(req: Request | null, params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? "",
        details: (params.details ?? "").slice(0, 2000),
        userId: params.user?.id ?? "",
        userName: params.user?.name ?? params.user?.email ?? "",
        ipAddress: req ? clientIp(req) : "",
      },
    });
  } catch {
    // auditoria nunca deve interromper a operação
  }
}
