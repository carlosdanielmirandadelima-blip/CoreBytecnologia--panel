import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Exige permissão de leitura de verdade (antes o campo era ignorado).
  const { error } = await requireApiKey(req, "read");
  if (error) return error;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { services: true },
  });

  return NextResponse.json({ data: projects, total: projects.length });
}
