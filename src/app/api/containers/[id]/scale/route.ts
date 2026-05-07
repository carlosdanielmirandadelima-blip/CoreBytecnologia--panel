import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { replicas } = body;

    if (!replicas || replicas < 1 || replicas > 20) {
      return NextResponse.json({ error: "Replicas deve ser entre 1 e 20" }, { status: 400 });
    }

    const container = docker.getContainer(params.id);
    const info = await container.inspect();
    const containerName = info.Name.replace("/", "");
    const image = info.Config.Image;
    const env = info.Config.Env || [];
    const ports = info.HostConfig.PortBindings || {};

    const created: string[] = [containerName];

    for (let i = 1; i < replicas; i++) {
      const replicaName = `${containerName}-replica-${i}`;

      try {
        const existing = docker.getContainer(replicaName);
        await existing.inspect();
        created.push(replicaName);
        continue;
      } catch {
        // Container doesn't exist, create it
      }

      const newContainer = await docker.createContainer({
        name: replicaName,
        Image: image,
        Env: env,
        HostConfig: {
          PortBindings: {},
          RestartPolicy: { Name: "unless-stopped" },
        },
      });
      await newContainer.start();
      created.push(replicaName);
    }

    const service = await prisma.service.findFirst({
      where: { containerId: params.id },
    });
    if (service) {
      await prisma.service.update({
        where: { id: service.id },
        data: { replicas },
      });
    }

    return NextResponse.json({ replicas: created.length, containers: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao escalar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
