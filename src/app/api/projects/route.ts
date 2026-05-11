import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectFromTemplate } from "@/lib/deploy";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const projects = await prisma.project.findMany({
    include: { services: true, envVars: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, type, templateId, envVars, services, description, gitUrl, branch, composeFile } = body;

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  if (type === "template" && templateId) {
    const envOverrides: Record<string, string> = {};
    if (envVars && Array.isArray(envVars)) {
      for (const ev of envVars) {
        envOverrides[ev.key] = ev.value;
      }
    }
    const project = await createProjectFromTemplate(name, templateId, envOverrides);
    return NextResponse.json(project, { status: 201 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || "",
      type: type || "custom",
      gitUrl: gitUrl || "",
      branch: branch || "main",
      composeFile: composeFile || "",
      status: "stopped",
      services: services?.length
        ? {
            create: services.map((s: { name: string; image: string; ports?: string; volumes?: string; command?: string }) => ({
              name: s.name,
              image: s.image,
              ports: s.ports || "",
              volumes: s.volumes || "",
              command: s.command || "",
            })),
          }
        : undefined,
      envVars: envVars?.length
        ? {
            create: envVars.map((ev: { key: string; value: string }) => ({
              key: ev.key,
              value: ev.value,
            })),
          }
        : undefined,
    },
    include: { services: true, envVars: true },
  });

  return NextResponse.json(project, { status: 201 });
}
