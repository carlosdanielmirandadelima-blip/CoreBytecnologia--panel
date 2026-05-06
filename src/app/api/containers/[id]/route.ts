import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContainer, removeContainer } from "@/lib/docker";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const container = await getContainer(params.id);
    return NextResponse.json(container);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Container não encontrado";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    await removeContainer(params.id, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao remover container";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
