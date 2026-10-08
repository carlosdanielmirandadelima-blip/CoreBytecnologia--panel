import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Docker from "dockerode";
import { writeAudit } from "@/lib/audit";

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
      labels: v.Labels || {},
    }));
    return NextResponse.json(volumeList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar volumes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "volumes.post", resource: "volumes", details: `Operação post em volumes` });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, driver } = body;

  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  try {
    // createVolume já devolve os dados do volume criado.
    const info = await docker.createVolume({
      Name: name,
      Driver: driver || "local",
    });
    return NextResponse.json(
      {
        name: info.Name,
        driver: info.Driver,
        mountpoint: info.Mountpoint,
        scope: info.Scope,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar volume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  // Trilha de auditoria desta operação.
  await writeAudit(null, { action: "volumes.delete", resource: "volumes", details: `Operação delete em volumes` });
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
