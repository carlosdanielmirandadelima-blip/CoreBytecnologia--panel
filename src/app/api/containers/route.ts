import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listContainers } from "@/lib/docker";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const containers = await listContainers(true);
    return NextResponse.json(containers);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao listar containers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
