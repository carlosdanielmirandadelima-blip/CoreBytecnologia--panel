import Docker from "dockerode";
import { prisma } from "./prisma";
import { getTemplate } from "./templates";
import { ensureImage, ensurePanelNetwork, PANEL_NETWORK } from "./docker";
import { normalizePortMapping, normalizeVolumeMapping, assertDomain } from "./validate";

/**
 * Implantação de projetos.
 *
 * Principais correções:
 *  - o domínio do projeto agora é realmente aplicado, criando labels do
 *    Traefik (antes o campo era ignorado e o app ficava sem URL e sem SSL);
 *  - os containers entram na rede compartilhada com o Traefik;
 *  - a imagem é baixada com o stream consumido antes de criar o container;
 *  - portas e volumes passam por validação.
 */

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const PROJECT_LABEL = "corebyte.project";
const SERVICE_LABEL = "corebyte.service";

export interface ServiceSpec {
  name: string;
  image: string;
  ports?: string;
  volumes?: string;
  command?: string;
}

function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function containerNameFor(project: string, service: string): string {
  return `cb-${sanitizeName(project)}-${sanitizeName(service)}`;
}

/**
 * Monta as labels do Traefik para expor o serviço em um domínio com HTTPS.
 * O Traefik roda com exposedbydefault=false, então sem estas labels
 * nada é publicado.
 */
function buildTraefikLabels(
  projectId: string,
  projectName: string,
  serviceName: string,
  containerPort: number,
  domain: string
): Record<string, string> {
  const router = `cb-${sanitizeName(projectName)}-${sanitizeName(serviceName)}-${projectId.slice(0, 6)}`;
  const labels: Record<string, string> = {
    "traefik.enable": "true",
    "traefik.docker.network": PANEL_NETWORK,
    [`traefik.http.services.${router}.loadbalancer.server.port`]: String(containerPort),
    [`traefik.http.routers.${router}.entrypoints`]: "websecure",
    [`traefik.http.routers.${router}.tls`]: "true",
    [`traefik.http.routers.${router}.tls.certresolver`]: "letsencrypt",
    [`traefik.http.routers.${router}.service`]: router,
  };

  if (domain) {
    // Domínio pode vir como "app.exemplo.com" (Host) ou "app.exemplo.com/api" (Host + PathPrefix).
    const slash = domain.indexOf("/");
    if (slash > 0) {
      const host = domain.slice(0, slash);
      const pathPrefix = domain.slice(slash);
      labels[`traefik.http.routers.${router}.rule`] =
        `Host(\`${host}\`) && PathPrefix(\`${pathPrefix}\`)`;
    } else {
      labels[`traefik.http.routers.${router}.rule`] = `Host(\`${domain}\`)`;
    }
  }

  // Redireciona o entrypoint web para websecure.
  labels[`traefik.http.routers.${router}-redirect.entrypoints`] = "web";
  if (domain) {
    const slash = domain.indexOf("/");
    const host = slash > 0 ? domain.slice(0, slash) : domain;
    labels[`traefik.http.routers.${router}-redirect.rule`] = `Host(\`${host}\`)`;
    labels[`traefik.http.routers.${router}-redirect.middlewares`] = `${router}-https`;
    labels[`traefik.http.middlewares.${router}-https.redirectscheme.scheme`] = "https";
    labels[`traefik.http.middlewares.${router}-https.redirectscheme.permanent`] = "true";
  }

  return labels;
}

/** Extrai a primeira porta de container de um mapeamento "8080:80". */
function firstContainerPort(ports: string): number | null {
  if (!ports) return null;
  const first = ports.split(",")[0]?.trim();
  if (!first) return null;
  const parts = first.split(":");
  const containerPort = parts.length > 1 ? parts[1] : parts[0];
  const n = Number(containerPort);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null;
}

export async function deployProject(projectId: string, onLog?: (msg: string) => void) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true, envVars: true },
  });
  if (!project) throw new Error("Projeto não encontrado");
  if (!project.services.length) {
    throw new Error(
      "Este projeto ainda não tem nenhum serviço. Adicione um serviço (imagem + porta) e implante de novo."
    );
  }

  const log = (m: string) => onLog?.(m);
  const network = await ensurePanelNetwork();
  const domain = project.domain ? assertDomain(project.domain) : "";

  // Ordem de precedência das variáveis: globais < projeto < serviço.
  const baseEnv: Record<string, string> = {};
  const globalVars = await prisma.globalEnvVar.findMany();
  for (const g of globalVars) baseEnv[g.key] = g.value;
  for (const ev of project.envVars) baseEnv[ev.key] = ev.value;

  /** Variáveis exclusivas do serviço (campo JSON no banco). */
  const serviceEnv = (raw: string): Record<string, string> => {
    try {
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return {};
      const out: Record<string, string> = {};
      for (const item of parsed) {
        if (item && typeof item.key === "string" && item.key) out[item.key] = String(item.value ?? "");
      }
      return out;
    } catch {
      return {};
    }
  };

  for (const service of project.services) {
    const containerName = containerNameFor(project.name, service.name);
    log(`Preparando ${service.name} (${service.image})...`);

    // Remove container anterior com o mesmo nome/id.
    const previousIds = new Set<string>();
    if (service.containerId) previousIds.add(service.containerId);
    const named = await docker.listContainers({ all: true, filters: { name: [containerName] } });
    for (const c of named) {
      if (c.Labels?.[PROJECT_LABEL] === project.id) previousIds.add(c.Id);
    }
    for (const id of Array.from(previousIds)) {
      try {
        const c = docker.getContainer(id);
        const info = await c.inspect();
        if (info.State.Running) await c.stop({ t: 10 });
        await c.remove({ force: true });
      } catch {
        // já não existe
      }
    }

    // Portas e volumes com validação.
    const portBindings: Record<string, { HostPort: string }[]> = {};
    const exposedPorts: Record<string, object> = {};
    if (service.ports) {
      for (const raw of service.ports.split(",")) {
        if (!raw.trim()) continue;
        const mapping = normalizePortMapping(raw.trim());
        const [hostPort, containerPort] = mapping.split(":");
        const key = `${containerPort}/tcp`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: hostPort }];
      }
    }

    const binds: string[] = [];
    if (service.volumes) {
      for (const raw of service.volumes.split(",")) {
        if (!raw.trim()) continue;
        binds.push(normalizeVolumeMapping(raw.trim()));
      }
    }

    log(`Baixando imagem ${service.image}...`);
    await ensureImage(service.image, (line) => log(`  ${line}`));

    // Exposição via Traefik. O domínio pode ser o do projeto ou um próprio do
    // serviço (útil para ter vários apps no mesmo projeto, cada um com URL).
    const containerPort = firstContainerPort(service.ports);
    const serviceDomain = service.domain ? assertDomain(service.domain) : domain;

    // `expose` controla a publicação. Mantém compatibilidade com projetos
    // antigos: se não houver a flag, publica quando houver domínio + porta.
    const shouldExpose =
      typeof service.expose === "boolean"
        ? service.expose
        : Boolean(serviceDomain && containerPort);

    const labels: Record<string, string> = {
      [PROJECT_LABEL]: project.id,
      [SERVICE_LABEL]: service.name,
      "corebyte.managed": "true",
    };
    let useNetwork = false;
    if (shouldExpose && containerPort && serviceDomain) {
      Object.assign(
        labels,
        buildTraefikLabels(project.id, project.name, service.name, containerPort, serviceDomain)
      );
      useNetwork = true;
      log(`Publicando ${service.name} em https://${serviceDomain} (porta interna ${containerPort})`);
    } else if (service.ports) {
      log(`Serviço ${service.name} sem publicação externa (acessível pela rede interna)`);
    }

    // Variáveis do serviço sobrescrevem as do projeto/globais.
    const envMap: Record<string, string> = { ...baseEnv, ...serviceEnv(service.envVars) };

    const createOptions: Docker.ContainerCreateOptions = {
      Image: service.image,
      name: containerName,
      Env: Object.entries(envMap).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: exposedPorts,
      Labels: labels,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        RestartPolicy: { Name: "unless-stopped" },
        ...(useNetwork ? { NetworkMode: network } : {}),
      },
    };

    if (service.command) {
      // Divide respeitando aspas simples para não quebrar comandos compostos.
      createOptions.Cmd = parseCommand(service.command);
    }

    const container = await docker.createContainer(createOptions);
    await container.start();
    const info = await container.inspect();

    await prisma.service.update({
      where: { id: service.id },
      data: { containerId: info.Id, status: "running" },
    });
    log(`${service.name} iniciado (${info.Id.slice(0, 12)})`);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "running", lastDeployAt: new Date(), lastError: "" },
  });
}

/** Divide um comando em argumentos, respeitando aspas. */
function parseCommand(command: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(command)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

/* ------------------------------------------------------------------ */

export async function stopProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  for (const service of project.services) {
    if (!service.containerId) continue;
    try {
      const container = docker.getContainer(service.containerId);
      const info = await container.inspect();
      if (info.State.Running) await container.stop({ t: 10 });
      await prisma.service.update({ where: { id: service.id }, data: { status: "stopped" } });
    } catch {
      await prisma.service.update({ where: { id: service.id }, data: { status: "stopped", containerId: "" } });
    }
  }
  await prisma.project.update({ where: { id: projectId }, data: { status: "stopped" } });
}

export async function startProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  let missing = false;
  for (const service of project.services) {
    if (!service.containerId) {
      missing = true;
      continue;
    }
    try {
      const container = docker.getContainer(service.containerId);
      await container.start();
      await prisma.service.update({ where: { id: service.id }, data: { status: "running" } });
    } catch {
      missing = true;
    }
  }

  // Se algum serviço não tem container (ou ele sumiu), refaz o deploy.
  if (missing) {
    await deployProject(projectId);
    return;
  }
  await prisma.project.update({ where: { id: projectId }, data: { status: "running" } });
}

export async function removeProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  for (const service of project.services) {
    if (!service.containerId) continue;
    try {
      const container = docker.getContainer(service.containerId);
      const info = await container.inspect();
      if (info.State.Running) await container.stop({ t: 10 });
      await container.remove({ force: true });
    } catch {
      // já removido
    }
  }

  await prisma.project.delete({ where: { id: projectId } });
}

/** Cria o projeto a partir de um template do catálogo interno. */
export async function createProjectFromTemplate(
  name: string,
  templateId: string,
  envOverrides?: Record<string, string>,
  extra?: { domain?: string; teamId?: string }
) {
  const template = getTemplate(templateId);
  if (!template) throw new Error("Template não encontrado");

  return prisma.project.create({
    data: {
      name,
      description: template.description,
      type: "template",
      templateId,
      domain: extra?.domain || "",
      teamId: extra?.teamId || "",
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
}

/**
 * Cria um projeto a partir de uma imagem única (usado pelo Marketplace
 * quando o template tem um só serviço) ou de uma lista de serviços.
 */
export async function createProjectWithServices(
  name: string,
  services: ServiceSpec[],
  opts: { description?: string; type?: string; domain?: string; teamId?: string; envVars?: { key: string; value: string }[] } = {}
) {
  if (!services.length) {
    throw new Error("Informe pelo menos um serviço (imagem) para criar o projeto.");
  }
  const normalized = services.map((s) => ({
    name: s.name || sanitizeName(s.image.split(":")[0].split("/").pop() || "app"),
    image: s.image,
    ports: s.ports ? s.ports.split(",").filter(Boolean).map((p) => normalizePortMapping(p.trim())).join(",") : "",
    volumes: s.volumes ? s.volumes.split(",").filter(Boolean).map((v) => normalizeVolumeMapping(v.trim())).join(",") : "",
    command: s.command || "",
  }));

  return prisma.project.create({
    data: {
      name,
      description: opts.description || "",
      type: opts.type || "custom",
      domain: opts.domain || "",
      teamId: opts.teamId || "",
      status: "stopped",
      services: { create: normalized },
      envVars: opts.envVars?.length ? { create: opts.envVars } : undefined,
    },
    include: { services: true, envVars: true },
  });
}

/** Reconcilia o estado do banco com o estado real dos containers. */
export async function syncProjectStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true },
  });
  if (!project) return null;

  let allRunning = project.services.length > 0;
  let anyRunning = false;

  for (const service of project.services) {
    if (!service.containerId) {
      allRunning = false;
      continue;
    }
    try {
      const info = await docker.getContainer(service.containerId).inspect();
      const status = info.State.Running ? "running" : "stopped";
      if (status !== service.status) {
        await prisma.service.update({ where: { id: service.id }, data: { status } });
      }
      if (info.State.Running) anyRunning = true;
      else allRunning = false;
    } catch {
      allRunning = false;
      if (service.status !== "stopped" || service.containerId) {
        await prisma.service.update({
          where: { id: service.id },
          data: { status: "stopped", containerId: "" },
        });
      }
    }
  }

  const newStatus = allRunning ? "running" : anyRunning ? "partial" : "stopped";
  if (newStatus !== project.status) {
    await prisma.project.update({ where: { id: projectId }, data: { status: newStatus } });
  }

  return prisma.project.findUnique({
    where: { id: projectId },
    include: { services: true, envVars: true },
  });
}
