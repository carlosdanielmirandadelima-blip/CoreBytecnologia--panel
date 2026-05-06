import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContainerLogs } from "@/lib/docker";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tail = parseInt(searchParams.get("tail") || "200");
    const logs = await getContainerLogs(params.id, tail);
    return NextResponse.json({ logs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao obter logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
