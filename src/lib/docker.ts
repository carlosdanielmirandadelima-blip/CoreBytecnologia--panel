import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export default docker;

export async function listContainers(all = true) {
  const containers = await docker.listContainers({ all });
  return containers.map((c) => ({
    id: c.Id,
    shortId: c.Id.substring(0, 12),
    names: c.Names.map((n) => n.replace(/^\//, "")),
    name: c.Names[0]?.replace(/^\//, "") || "unknown",
    image: c.Image,
    state: c.State,
    status: c.Status,
    ports: c.Ports.map((p) => ({
      privatePort: p.PrivatePort,
      publicPort: p.PublicPort,
      type: p.Type,
    })),
    created: new Date(c.Created * 1000).toISOString(),
  }));
}

export async function getContainer(id: string) {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  return {
    id: info.Id,
    shortId: info.Id.substring(0, 12),
    name: info.Name.replace(/^\//, ""),
    image: info.Config.Image,
    state: info.State.Status,
    status: info.State.Status,
    running: info.State.Running,
    created: info.Created,
    started: info.State.StartedAt,
    finished: info.State.FinishedAt,
    ports: Object.entries(info.NetworkSettings.Ports || {}).map(
      ([container_port, bindings]) => ({
        containerPort: container_port,
        hostBindings: bindings || [],
      })
    ),
    env: info.Config.Env || [],
    mounts: info.Mounts.map((m) => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
    })),
    networks: Object.keys(info.NetworkSettings.Networks || {}),
    restartPolicy: info.HostConfig.RestartPolicy,
  };
}

export async function startContainer(id: string) {
  const container = docker.getContainer(id);
  await container.start();
}

export async function stopContainer(id: string) {
  const container = docker.getContainer(id);
  await container.stop();
}

export async function restartContainer(id: string) {
  const container = docker.getContainer(id);
  await container.restart();
}

export async function removeContainer(id: string, force = false) {
  const container = docker.getContainer(id);
  await container.remove({ force });
}

export async function getContainerLogs(
  id: string,
  tail = 100
): Promise<string> {
  const container = docker.getContainer(id);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString();
}

export async function getContainerStats(id: string) {
  const container = docker.getContainer(id);
  const stats = await container.stats({ stream: false });
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0
      ? (cpuDelta / systemDelta) *
        (stats.cpu_stats.online_cpus || 1) *
        100
      : 0;
  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;
  const memPercent = (memUsage / memLimit) * 100;
  return {
    cpu: Math.round(cpuPercent * 100) / 100,
    memory: {
      usage: memUsage,
      limit: memLimit,
      percent: Math.round(memPercent * 100) / 100,
    },
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
    shortId: img.Id.substring(7, 19),
    tags: img.RepoTags || [],
    size: img.Size,
    created: new Date(img.Created * 1000).toISOString(),
  }));
}
