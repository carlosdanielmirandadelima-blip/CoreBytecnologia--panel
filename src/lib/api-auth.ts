import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function authenticateApiKey(req: NextRequest): Promise<{ userId: string; permissions: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const key = authHeader.substring(7);
  const apiKey = await prisma.apiKey.findUnique({ where: { key } });

  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return { userId: apiKey.userId, permissions: apiKey.permissions };
}
