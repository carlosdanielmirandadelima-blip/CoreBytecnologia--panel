import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function GET(req: NextRequest) {
  // Exige permissão de leitura de verdade (antes o campo era ignorado).
  const { error } = await requireApiKey(req, "read");
  if (error) return error;

  try {
    const containers = await docker.listContainers({ all: true });
    const data = containers.map((c) => ({
      id: c.Id.substring(0, 12),
      name: c.Names[0]?.replace("/", "") || "",
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports,
      created: c.Created,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch {
    return NextResponse.json({ error: "Docker unavailable" }, { status: 500 });
  }
}
