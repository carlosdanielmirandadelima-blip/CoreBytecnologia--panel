import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hashApiKey } from "@/lib/api-auth";
import { requireSession } from "@/lib/session";
import { assertString } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";

/**
 * Gerenciamento de chaves de API.
 *
 * A chave completa só é mostrada uma única vez (na criação); no banco fica
 * apenas o hash, para que um vazamento do banco não exponha as chaves.
 */

export async function GET() {
  const { user, error } = await requireSession();
  if (error) return error;

  const keys = await prisma.apiKey.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      lastUsed: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireSession();
  if (error) return error;

  try {
    const body = (await req.json()) as {
      name?: string;
      permissions?: string;
      expiresInDays?: number;
    };
    const name = assertString(body.name, "nome", 120, true);

    const permissions = ["read", "write", "admin"].includes(String(body.permissions))
      ? String(body.permissions)
      : "read";

    const raw = `cb_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = raw.substring(0, 11) + "…";

    let expiresAt: Date | null = null;
    const days = Number(body.expiresInDays);
    if (Number.isInteger(days) && days > 0 && days <= 3650) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const record = await prisma.apiKey.create({
      data: {
        name,
        key: hashApiKey(raw),
        prefix,
        permissions,
        expiresAt,
        userId: user!.id,
      },
    });

    await writeAudit(req, {
      action: "api-key.create",
      resource: "api-key",
      resourceId: record.id,
      details: `Chave de API "${name}" criada (permissão: ${permissions})`,
      user,
    });

    // A chave completa aparece só aqui, uma vez.
    return NextResponse.json(
      {
        id: record.id,
        name: record.name,
        prefix: record.prefix,
        permissions: record.permissions,
        expiresAt: record.expiresAt,
        key: raw,
        warning: "Guarde esta chave agora: ela não será mostrada novamente.",
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar a chave";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
