import Docker from "dockerode";
import { PassThrough } from "stream";
import { demuxLogBuffer } from "./docker-logs";

/**
 * Camada de acesso ao Docker.
 *
 * Correções importantes em relação à versão anterior:
 *  - o prune/remoção de containers do painel nunca remove o próprio painel;
 *  - `pullImage` consome o stream de progresso (antes o pull podia não
 *    concluir e o container era criado antes da imagem existir);
 *  - `getContainerLogs` faz o demux de stdout/stderr, que sem isso aparece
 *    como lixo binário no terminal.
 */

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/** Containers do próprio painel — nunca devem ser alvo de operações. */
export const PANEL_CONTAINERS = ["corebyte-panel", "corebyte-traefik", "corebyte-worker"];

export function isPanelContainer(nameOrId: string): boolean {
  const clean = String(nameOrId).replace(/^\//, "");
  return PANEL_CONTAINERS.some((n) => clean === n || clean.startsWith(n + "-"));
}

export function assertNotPanel(nameOrId: string): void {
  if (isPanelContainer(nameOrId)) {
    throw new Error("Este container pertence ao próprio painel e não pode ser alterado por aqui.");
  }
}

export default docker;

/* ------------------------------------------------------------------ */
/* Listagem e inspeção                                                 */
/* ------------------------------------------------------------------ */

export async function listContainers(all = true) {
  const containers = await docker.listContainers({ all });
  return containers.map((c) => {
    const name = c.Names[0]?.replace(/^\//, "") || "unknown";
    return {
      id: c.Id,
      shortId: c.Id.substring(0, 12),
      names: c.Names.map((n) => n.replace(/^\//, "")),
      name,
      image: c.Image,
      state: c.State,
      status: c.Status,
      projectId: c.Labels?.["corebyte.project"] || "",
      isPanel: isPanelContainer(name),
      ports: (c.Ports || []).map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
      created: new Date(c.Created * 1000).toISOString(),
    };
  });
}

export async function getContainer(id: string) {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  const name = info.Name.replace(/^\//, "");
  return {
    id: info.Id,
    shortId: info.Id.substring(0, 12),
    name,
    image: info.Config.Image,
    state: info.State.Status,
    running: info.State.Running,
    isPanel: isPanelContainer(name),
    created: info.Created,
    started: info.State.StartedAt,
    finished: info.State.FinishedAt,
    ports: Object.entries(info.NetworkSettings.Ports || {}).map(([containerPort, bindings]) => ({
      containerPort,
      hostBindings: bindings || [],
    })),
    env: info.Config.Env || [],
    mounts: (info.Mounts || []).map((m) => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
    })),
    networks: Object.keys(info.NetworkSettings.Networks || {}),
    restartPolicy: info.HostConfig.RestartPolicy,
  };
}

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

export async function startContainer(id: string) {
  const info = await docker.getContainer(id).inspect();
  assertNotPanel(info.Name);
  await docker.getContainer(id).start();
}

export async function stopContainer(id: string) {
  const info = await docker.getContainer(id).inspect();
  assertNotPanel(info.Name);
  await docker.getContainer(id).stop();
}

export async function restartContainer(id: string) {
  const info = await docker.getContainer(id).inspect();
  assertNotPanel(info.Name);
  await docker.getContainer(id).restart();
}

export async function removeContainer(id: string, force = false) {
  const info = await docker.getContainer(id).inspect();
  assertNotPanel(info.Name);
  await docker.getContainer(id).remove({ force });
}

/* ------------------------------------------------------------------ */
/* Logs (com demux)                                                    */
/* ------------------------------------------------------------------ */

export async function getContainerLogs(id: string, tail = 200, opts: { stderr?: boolean } = {}): Promise<string> {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  const tty = Boolean(info.Config.Tty);

  // IMPORTANTE: sem `follow`, o dockerode devolve um Buffer (não um stream),
  // com stdout/stderr multiplexados por cabeçalhos de 8 bytes. Fazer
  // .toString() direto (como antes) mostrava lixo binário no terminal.
  const raw = (await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: false,
    follow: false,
  })) as unknown;

  if (Buffer.isBuffer(raw)) {
    const demuxed = demuxLogBuffer(raw, tty);
    return opts.stderr ? demuxed.stderr : demuxed.combined;
  }

  // Caso o retorno seja um stream (versões que ignoram o Buffer), lê tudo.
  const stream = raw as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return demuxLogBuffer(Buffer.concat(chunks), tty).combined;
}

/** Stream de logs ao vivo (para o terminal do painel). */
export async function streamContainerLogs(
  id: string,
  onData: (chunk: Buffer) => void,
  tail = 200
): Promise<() => void> {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  const tty = Boolean(info.Config.Tty);

  const stream = (await container.logs({
    stdout: true,
    stderr: true,
    tail,
    follow: true,
  })) as unknown as NodeJS.ReadableStream;

  if (tty) {
    stream.on("data", (c: Buffer) => onData(Buffer.from(c)));
  } else {
    const out = new PassThrough();
    out.on("data", (c: Buffer) => onData(Buffer.from(c)));
    docker.modem.demuxStream(stream, out, out);
  }

  return () => {
    (stream as unknown as { destroy?: () => void }).destroy?.();
  };
}

/* ------------------------------------------------------------------ */
/* Métricas                                                           */
/* ------------------------------------------------------------------ */

export async function getContainerStats(id: string) {
  const stats = await docker.getContainer(id).stats({ stream: false });
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;

  const networks: Record<string, { rx: number; tx: number }> = {};
  for (const [name, n] of Object.entries(stats.networks || {})) {
    networks[name] = { rx: n.rx_bytes, tx: n.tx_bytes };
  }

  return {
    cpu: Math.round(cpuPercent * 100) / 100,
    memory: {
      usage: memUsage,
      limit: memLimit,
      percent: Math.round((memUsage / memLimit) * 100 * 100) / 100,
    },
    networks,
  };
}

export async function getSystemInfo() {
  const info = await docker.info();
  return {
    containers: info.Containers,
    containersRunning: info.ContainersRunning,
    containersPaused: info.ContainersPaused,
    containersStopped: info.ContainersStopped,
    images: info.Images,
    serverVersion: info.ServerVersion,
    operatingSystem: info.OperatingSystem,
    totalMemory: info.MemTotal,
    cpus: info.NCPU,
  };
}

export async function listImages() {
  const images = await docker.listImages();
  return images.map((img) => ({
    id: img.Id,
    shortId: img.Id.replace("sha256:", "").substring(0, 12),
    tags: img.RepoTags || [],
    size: img.Size,
    created: new Date(img.Created * 1000).toISOString(),
  }));
}

export async function removeImage(id: string, force = false) {
  await docker.getImage(id).remove({ force });
}

/* ------------------------------------------------------------------ */
/* Imagens                                                             */
/* ------------------------------------------------------------------ */

/**
 * Baixa uma imagem consumindo o stream de progresso.
 * Sem isso o pull pode não concluir e o container é criado
 * antes de a imagem existir.
 */
export async function pullImage(image: string, onProgress?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        // Se já existe localmente, não é erro.
        if (String(err.message).includes("already being pulled")) return resolve();
        return reject(err);
      }
      docker.modem.followProgress(
        stream,
        (finishErr: Error | null) => {
          if (finishErr) return reject(finishErr);
          resolve();
        },
        (event: { status?: string; progress?: string; error?: string }) => {
          if (event?.error) return reject(new Error(event.error));
          if (onProgress && event?.status) {
            onProgress(`${event.status}${event.progress ? " " + event.progress : ""}`);
          }
        }
      );
    });
  });
}

/** Garante que a imagem existe localmente (pull só se faltar). */
export async function ensureImage(image: string, onProgress?: (line: string) => void): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch {
    // não existe: baixa
  }
  await pullImage(image, onProgress);
}

/* ------------------------------------------------------------------ */
/* Container auxiliar (usado por backup/restore)                        */
/* ------------------------------------------------------------------ */

const HELPER_IMAGE = "alpine:3.20";
let helperReady = false;

/**
 * Roda um container efêmero com argumentos fixos.
 *
 * Substitui os `docker run ...` montados por string, que permitiam
 * injeção de comando pelo campo `source` do backup.
 */
export async function runHelper(
  args: string[],
  binds: string[],
  opts: { timeoutMs?: number; network?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  if (!helperReady) {
    await ensureImage(HELPER_IMAGE);
    helperReady = true;
  }

  const container = await docker.createContainer({
    Image: HELPER_IMAGE,
    Cmd: args,
    Tty: false,
    Labels: { "corebyte.helper": "true" },
    HostConfig: {
      Binds: binds,
      AutoRemove: false,
      ...(opts.network ? { NetworkMode: opts.network } : {}),
    },
  });

  try {
    await container.start();

    const timeout = opts.timeoutMs ?? 30 * 60 * 1000;
    const wait = container.wait();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado ao executar a operação")), timeout)
    );
    await Promise.race([wait, timeoutPromise]);

    const info = await container.inspect();
    const code = info.State.ExitCode;

    // Sem `follow` o retorno é Buffer multiplexado (ver docker-logs.ts).
    const rawLogs = (await container.logs({ stdout: true, stderr: true })) as unknown;
    let text: string;
    if (Buffer.isBuffer(rawLogs)) {
      text = demuxLogBuffer(rawLogs, Boolean(info.Config.Tty)).combined;
    } else {
      const stream = rawLogs as NodeJS.ReadableStream;
      const out = new PassThrough();
      const buf: Buffer[] = [];
      out.on("data", (c: Buffer) => buf.push(Buffer.from(c)));
      const ended = new Promise<void>((res) => out.on("end", res));
      docker.modem.demuxStream(stream, out, out);
      (stream as unknown as { on: (e: string, cb: () => void) => void }).on("end", () => out.end());
      await ended;
      text = demuxLogBuffer(Buffer.concat(buf), Boolean(info.Config.Tty)).combined;
    }
    if (code !== 0) {
      throw new Error(`A operação falhou (código ${code}): ${text.slice(0, 300)}`);
    }
    return { stdout: text, stderr: "" };
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Redes                                                              */
/* ------------------------------------------------------------------ */

export const PANEL_NETWORK = "corebyte";

/** Garante que a rede compartilhada com o Traefik existe. */
export async function ensurePanelNetwork(): Promise<string> {
  const networks = await docker.listNetworks({ filters: { name: [PANEL_NETWORK] } });
  const exact = networks.find((n) => n.Name === PANEL_NETWORK);
  if (exact) return exact.Id;
  // A rede precisa dos rótulos que o Docker Compose espera; sem eles o
  // `docker compose up` recusa reutilizar a rede criada pelo painel
  // ("network exists but was not created by compose").
  const created = await docker.createNetwork({
    Name: PANEL_NETWORK,
    Driver: "bridge",
    Labels: {
      "corebyte.managed": "true",
      "com.docker.compose.project": "corebyte",
      "com.docker.compose.network": PANEL_NETWORK,
    },
  });
  return created.id;
}
