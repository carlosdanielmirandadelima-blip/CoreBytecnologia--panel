import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const envVars = await prisma.globalEnvVar.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(envVars);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { key, value, description } = body;

  if (!key) return NextResponse.json({ error: "Chave é obrigatória" }, { status: 400 });

  const existing = await prisma.globalEnvVar.findUnique({ where: { key } });
  if (existing) return NextResponse.json({ error: "Variável já existe" }, { status: 400 });

  const envVar = await prisma.globalEnvVar.create({
    data: { key, value: value || "", description: description || "" },
  });

  return NextResponse.json(envVar, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, key, value, description } = body;

  if (!id) return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });

  const envVar = await prisma.globalEnvVar.update({
    where: { id },
    data: { key, value, description },
  });

  return NextResponse.json(envVar);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });

  await prisma.globalEnvVar.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
