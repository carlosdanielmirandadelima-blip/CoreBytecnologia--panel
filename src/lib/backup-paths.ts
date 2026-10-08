import fs from "fs";
import os from "os";
import path from "path";
import docker from "./docker";

/**
 * Descoberta do caminho real do diretório de backups para containers auxiliares.
 *
 * Problema que isto resolve: quando o painel roda DENTRO de um container,
 * `BACKUP_DIR` (ex.: /app/data/backups) é um caminho interno. Ao pedir ao
 * daemon do Docker que crie um container auxiliar com
 * `-v /app/data/backups:/backup`, o daemon interpreta o caminho como sendo
 * **do host** — onde ele não existe. O resultado era o backup falhar com
 * "ENOENT ... /app/data/backups/<arquivo>.tar.gz".
 *
 * Solução: o painel se inspeciona pelo próprio ID (o hostname do container é
 * o ID) e descobre qual volume/caminho do host contém o diretório de backups.
 * O container auxiliar monta ESSA origem na MESMA posição, então ambos
 * enxergam exatamente a mesma árvore de arquivos — e o caminho do arquivo
 * dentro do helper é igual ao caminho local do painel.
 */

export interface BackupMount {
  /** O que passar para `-v` no container auxiliar (nome do volume ou caminho do host). */
  source: string;
  /** Onde montar essa origem no container auxiliar (mesma posição do painel). */
  destination: string;
  /** Descreve como foi resolvido (útil para diagnóstico). */
  how: string;
}

let cached: BackupMount | null = null;

/** Detecta se este processo está rodando dentro de um container. */
export function insideContainer(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
    if (fs.existsSync("/run/.containerenv")) return true;
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
    if (/docker|containerd|kubepods|podman/.test(cgroup)) return true;
  } catch {
    // sem os arquivos: assume host
  }
  return false;
}

/**
 * Resolve como montar o diretório de backups no container auxiliar.
 *
 * @param localDir caminho absoluto que ESTE processo usa (ex.: /app/data/backups)
 */
export async function resolveBackupMount(localDir: string): Promise<BackupMount> {
  if (cached) return cached;

  // Fora de container, o caminho local já é o caminho do host.
  if (!insideContainer()) {
    cached = {
      source: localDir,
      destination: localDir,
      how: "caminho local (painel rodando fora de container)",
    };
    return cached;
  }

  try {
    // O hostname de um container é o seu ID; inspecionamos a nós mesmos.
    const selfId = os.hostname();
    const self = await docker.getContainer(selfId).inspect();

    const mounts = (self.Mounts || []) as Array<{
      Type: string;
      Name?: string;
      Source: string;
      Destination: string;
    }>;

    // Escolhe o mount mais específico que contém o diretório de backups.
    const match = mounts
      .filter((m) => localDir === m.Destination || localDir.startsWith(m.Destination + "/"))
      .sort((a, b) => b.Destination.length - a.Destination.length)[0];

    if (!match) {
      // Nenhum mount cobre o diretório: o helper vê o mesmo caminho interno
      // (funciona porque o diretório existe na imagem).
      cached = {
        source: localDir,
        destination: localDir,
        how: "caminho interno do container (sem volume montado)",
      };
      return cached;
    }

    if (match.Type === "volume" && match.Name) {
      cached = {
        source: match.Name,
        destination: match.Destination,
        how: `volume nomeado "${match.Name}" (${match.Destination})`,
      };
      return cached;
    }

    cached = {
      source: match.Source,
      destination: match.Destination,
      how: `bind mount do host "${match.Source}" (${match.Destination})`,
    };
    return cached;
  } catch (e) {
    cached = {
      source: localDir,
      destination: localDir,
      how: `caminho interno (falha ao inspecionar: ${e instanceof Error ? e.message : "erro"})`,
    };
    return cached;
  }
}

/**
 * Montagens prontas para o container auxiliar, no formato `origem:destino[:ro]`.
 *
 * O caminho dos arquivos dentro do helper é o MESMO do painel (`localDir`),
 * porque a origem é montada na mesma posição.
 */
export async function backupBinds(localDir: string, readOnly = false): Promise<string[]> {
  const m = await resolveBackupMount(localDir);
  const suffix = readOnly ? ":ro" : "";
  return [`${m.source}:${m.destination}${suffix}`];
}

/** Diagnóstico: explica como o diretório foi resolvido. */
export async function describeBackupMount(localDir: string): Promise<string> {
  const m = await resolveBackupMount(localDir);
  return `${m.how} — arquivos em ${path.posix.join(m.destination, path.relative(m.destination, localDir)) || m.destination}`;
}

/** Limpa o cache (usado em testes). */
export function resetBackupMountCache(): void {
  cached = null;
}
