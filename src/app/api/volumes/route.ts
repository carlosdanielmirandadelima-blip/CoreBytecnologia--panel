import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const volumes = await docker.listVolumes();
    const volumeList = (volumes.Volumes || []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      scope: v.Scope,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
    }));
    return NextResponse.json(volumeList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar volumes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, driver } = body;

  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  try {
    const volume = await docker.createVolume({
      Name: name,
      Driver: driver || "local",
    });
    const info = await volume.inspect();
    return NextResponse.json({
      name: info.Name,
      driver: info.Driver,
      mountpoint: info.Mountpoint,
      scope: info.Scope,
      createdAt: info.CreatedAt,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar volume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name) return NextResponse.json({ error: "Nome do volume é obrigatório" }, { status: 400 });

  try {
    const volume = docker.getVolume(name);
    await volume.remove();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao remover volume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
