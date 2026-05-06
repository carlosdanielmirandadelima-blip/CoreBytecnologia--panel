import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startContainer, stopContainer, restartContainer } from "@/lib/docker";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; action: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    switch (params.action) {
      case "start":
        await startContainer(params.id);
        break;
      case "stop":
        await stopContainer(params.id);
        break;
      case "restart":
        await restartContainer(params.id);
        break;
      default:
        return NextResponse.json(
          { error: "Ação inválida" },
          { status: 400 }
        );
    }
    return NextResponse.json({ success: true, action: params.action });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao executar ação";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
