import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deployProject, startProject, stopProject } from "@/lib/deploy";

export async function POST(
  req: Request,
  { params }: { params: { id: string; action: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, action } = params;

  try {
    switch (action) {
      case "deploy":
        await deployProject(id);
        return NextResponse.json({ success: true, message: "Projeto em deploy" });

      case "start":
        await startProject(id);
        return NextResponse.json({ success: true, message: "Projeto iniciado" });

      case "stop":
        await stopProject(id);
        return NextResponse.json({ success: true, message: "Projeto parado" });

      case "redeploy":
        await stopProject(id);
        await deployProject(id);
        return NextResponse.json({ success: true, message: "Projeto reimplantado" });

      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na ação";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
