import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSystemInfo } from "@/lib/docker";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const info = await getSystemInfo();
    return NextResponse.json(info);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao obter info do sistema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
