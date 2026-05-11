import Docker from "dockerode";
import { prisma } from "./prisma";
import { getTemplate } from "./templates";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const PROJECT_LABEL = "corebyte.project";
const SERVICE_LABEL = "corebyte.service";

export async function deployProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true, envVars: true },
  });

  if (!project) throw new Error("Projeto não encontrado");

  const envMap: Record<string, string> = {};
  for (const ev of project.envVars) {
    envMap[ev.key] = ev.value;
  }

  for (const service of project.services) {
    const containerName = `${project.name}_${service.name}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (service.containerId) {
      try {
        const existing = docker.getContainer(service.containerId);
        const info = await existing.inspect();
        if (info.State.Running) {
          await existing.stop();
        }
        await existing.remove({ force: true });
      } catch {
        // container doesn't exist anymore
      }
    }

    const portBindings: Record<string, { HostPort: string }[]> = {};
    const exposedPorts: Record<string, object> = {};
    if (service.ports) {
      for (const portMap of service.ports.split(",")) {
        const [hostPort, containerPort] = portMap.trim().split(":");
        if (hostPort && containerPort) {
          const key = `${containerPort}/tcp`;
          exposedPorts[key] = {};
          portBindings[key] = [{ HostPort: hostPort }];
        }
      }
    }

    const binds: string[] = [];
    if (service.volumes) {
      for (const vol of service.volumes.split(",")) {
        binds.push(vol.trim());
      }
    }

    const env = Object.entries(envMap).map(([k, v]) => `${k}=${v}`);

    try {
      await docker.pull(service.image);
    } catch {
      // image might already exist locally
    }

    const createOptions: Docker.ContainerCreateOptions = {
      Image: service.image,
      name: containerName,
      Env: env,
      ExposedPorts: exposedPorts,
      Labels: {
        [PROJECT_LABEL]: project.id,
        [SERVICE_LABEL]: service.name,
      },
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        RestartPolicy: { Name: "unless-stopped" },
      },
    };

    if (service.command) {
      createOptions.Cmd = service.command.split(" ");
    }

    const container = await docker.createContainer(createOptions);
    await container.start();

    const info = await container.inspect();
    await prisma.service.update({
      where: { id: service.id },
      data: {
        containerId: info.Id,
        status: "running",
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "running" },
  });
}

export async function stopProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });

  if (!project) throw new Error("Projeto não encontrado");

  for (const service of project.services) {
    if (service.containerId) {
      try {
        const container = docker.getContainer(service.containerId);
        await container.stop();
        await prisma.service.update({
          where: { id: service.id },
          data: { status: "stopped" },
        });
      } catch {
        // container might not exist
      }
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "stopped" },
  });
}

export async function startProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });

  if (!project) throw new Error("Projeto não encontrado");

  for (const service of project.services) {
    if (service.containerId) {
      try {
        const container = docker.getContainer(service.containerId);
        await container.start();
        await prisma.service.update({
          where: { id: service.id },
          data: { status: "running" },
        });
      } catch {
        // container might not exist, redeploy needed
      }
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "running" },
  });
}

export async function removeProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });

  if (!project) throw new Error("Projeto não encontrado");

  for (const service of project.services) {
    if (service.containerId) {
      try {
        const container = docker.getContainer(service.containerId);
        const info = await container.inspect();
        if (info.State.Running) {
          await container.stop();
        }
        await container.remove({ force: true });
      } catch {
        // container might not exist
      }
    }
  }

  await prisma.project.delete({
    where: { id: projectId },
  });
}

export async function createProjectFromTemplate(
  name: string,
  templateId: string,
  envOverrides?: Record<string, string>
) {
  const template = getTemplate(templateId);
  if (!template) throw new Error("Template não encontrado");

  const project = await prisma.project.create({
    data: {
      name,
      description: template.description,
      type: "template",
      templateId,
      status: "stopped",
      services: {
        create: template.services.map((s) => ({
          name: s.name,
          image: s.image,
          ports: s.ports,
          volumes: s.volumes,
          command: s.command,
        })),
      },
      envVars: {
        create: template.envVars.map((ev) => ({
          key: ev.key,
          value: envOverrides?.[ev.key] ?? ev.value,
        })),
      },
    },
    include: { services: true, envVars: true },
  });

  return project;
}

export async function syncProjectStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });

  if (!project) return null;

  let allRunning = true;
  let anyRunning = false;

  for (const service of project.services) {
    if (service.containerId) {
      try {
        const container = docker.getContainer(service.containerId);
        const info = await container.inspect();
        const status = info.State.Running ? "running" : "stopped";
        if (status !== service.status) {
          await prisma.service.update({
            where: { id: service.id },
            data: { status },
          });
        }
        if (info.State.Running) anyRunning = true;
        else allRunning = false;
      } catch {
        allRunning = false;
        if (service.status !== "stopped") {
          await prisma.service.update({
            where: { id: service.id },
            data: { status: "stopped", containerId: "" },
          });
        }
      }
    } else {
      allRunning = false;
    }
  }

  const newStatus = allRunning && project.services.length > 0
    ? "running"
    : anyRunning
    ? "partial"
    : "stopped";

  if (newStatus !== project.status) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: newStatus },
    });
  }

  return prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true, envVars: true },
  });
}
