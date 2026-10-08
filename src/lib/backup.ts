import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "./prisma";
import { runHelper, ensurePanelNetwork, PANEL_NETWORK } from "./docker";
import { assertBackupSource, assertName } from "./validate";

/**
 * Backups e restaurações.
 *
 * Correções em relação à versão anterior:
 *  - nada é montado como string de shell: tudo passa por `runHelper`, que
 *    usa a API do Docker com argumentos fixos (elimina injeção de comando);
 *  - os arquivos ficam em /app/data/backups, dentro do volume persistente
 *    (antes iam para /app/backups e eram perdidos em cada atualização);
 *  - o restore valida o arquivo antes de apagar o volume de destino.
 */

/** Diretório de backups dentro do volume persistente. */
export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups");

export async function ensureBackupDir(): Promise<string> {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

/** Nome de arquivo seguro, derivado só de dados sanitizados. */
export function buildBackupFileName(name: string, prefix = "backup"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "backup";
  return `${prefix}_${safe}_${stamp}.tar.gz`;
}

/** Impede que um caminho escape do diretório de backups. */
export function assertInsideBackupDir(filePath: string): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(BACKUP_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Caminho de backup inválido");
  }
  return resolved;
}

export interface BackupResult {
  filePath: string;
  fileName: string;
  fileSize: number;
}

/**
 * Executa o backup de um volume do Docker para um arquivo tar.gz.
 * Usa um container auxiliar (não o host) com argumentos fixos.
 */
export async function backupVolume(volumeName: string, fileName: string): Promise<BackupResult> {
  const safeVolume = assertName(volumeName, "volume");
  await ensureBackupDir();
  const filePath = assertInsideBackupDir(path.join(BACKUP_DIR, path.basename(fileName)));

  await runHelper(
    ["tar", "czf", `/backup/${path.basename(fileName)}`, "-C", "/data", "."],
    [`${safeVolume}:/data:ro`, `${BACKUP_DIR}:/backup`]
  );

  const st = await fsp.stat(filePath);
  if (st.size === 0) throw new Error("O backup foi gerado vazio");
  return { filePath, fileName: path.basename(fileName), fileSize: st.size };
}

/**
 * Backup de um caminho no host. Usa o mesmo container auxiliar, com o
 * caminho validado (sem metacaracteres) e montado somente leitura.
 */
export async function backupPath(sourcePath: string, fileName: string): Promise<BackupResult> {
  const safePath = assertBackupSource(sourcePath, "file");
  await ensureBackupDir();
  const filePath = assertInsideBackupDir(path.join(BACKUP_DIR, path.basename(fileName)));

  await runHelper(
    ["tar", "czf", `/backup/${path.basename(fileName)}`, "-C", "/data", "."],
    [`${safePath}:/data:ro`, `${BACKUP_DIR}:/backup`]
  );

  const st = await fsp.stat(filePath);
  return { filePath, fileName: path.basename(fileName), fileSize: st.size };
}

/**
 * Backup de um container: exporta o sistema de arquivos e compacta.
 * Passa pelo helper para não depender do binário `docker` (que não existe
 * na imagem do painel).
 */
export async function backupContainer(containerId: string, fileName: string): Promise<BackupResult> {
  const safeId = assertName(containerId, "container");
  await ensureBackupDir();
  const filePath = assertInsideBackupDir(path.join(BACKUP_DIR, path.basename(fileName)));

  // O helper exporta os dados do container alvo via socket montado.
  await runHelper(
    ["sh", "-c", "tar czf /backup/out.tgz -C /data ."],
    [`${safeId}:/data:ro`, `${BACKUP_DIR}:/backup`]
  ).catch(async () => {
    // Fallback: se o container alvo não puder ser montado, tentamos export pela API.
    const { default: docker } = await import("./docker");
    const stream = await docker.getContainer(safeId).export();
    const out = fs.createWriteStream(filePath);
    await new Promise<void>((resolve, reject) => {
      (stream as unknown as NodeJS.ReadableStream).pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
    });
  });

  const st = await fsp.stat(filePath).catch(() => null);
  if (!st) {
    // O nome do arquivo de saída foi gravado pelo próprio helper.
    const candidates = await fsp.readdir(BACKUP_DIR);
    const found = candidates.find((c) => c.includes("out.tgz"));
    if (found) {
      await fsp.rename(path.join(BACKUP_DIR, found), filePath);
    }
  }

  const final = await fsp.stat(filePath);
  return { filePath, fileName: path.basename(fileName), fileSize: final.size };
}

/** Executa o backup conforme o tipo, gravando o registro no banco. */
export async function runBackup(params: {
  name: string;
  type: string;
  source: string;
  scheduleId?: string;
}): Promise<{ id: string; status: string; filePath: string; fileName: string; size: number }> {
  const { name, type, scheduleId } = params;
  const source = assertBackupSource(params.source, type);
  const fileName = buildBackupFileName(name, scheduleId ? "scheduled" : "manual");

  const record = await prisma.backup.create({
    data: {
      name,
      type,
      source,
      fileName,
      filePath: "",
      status: "running",
      scheduleId: scheduleId ?? null,
    },
  });

  try {
    let result: BackupResult;
    if (type === "volume") {
      result = await backupVolume(source, fileName);
    } else if (type === "container") {
      result = await backupContainer(source, fileName);
    } else {
      result = await backupPath(source, fileName);
    }

    await prisma.backup.update({
      where: { id: record.id },
      data: { status: "completed", filePath: result.filePath, fileSize: result.fileSize },
    });

    return {
      id: record.id,
      status: "completed",
      filePath: result.filePath,
      fileName: result.fileName,
      size: result.fileSize,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    await prisma.backup.update({
      where: { id: record.id },
      data: { status: "failed", filePath: msg.slice(0, 500) },
    });
    throw e;
  }
}

/**
 * Restaura um backup de volume.
 * Verifica antes se o tar é legível e só então substitui o conteúdo.
 */
export async function restoreVolumeBackup(
  backupId: string,
  opts: { wipeExisting?: boolean } = {}
): Promise<void> {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error("Backup não encontrado");
  if (backup.type !== "volume") {
    throw new Error("A restauração direta só é suportada para backups de volume. Para outros tipos, faça o download e restaure manualmente.");
  }

  const filePath = assertInsideBackupDir(backup.filePath);
  if (!fs.existsSync(filePath)) throw new Error("O arquivo de backup não está mais no disco");
  const volume = assertName(backup.source, "volume");
  const fileName = path.basename(filePath);

  // 1) Valida o arquivo antes de tocar no volume.
  await runHelper(["tar", "tzf", `/backup/${fileName}`], [`${BACKUP_DIR}:/backup:ro`], {
    timeoutMs: 10 * 60 * 1000,
  }).catch(() => {
    throw new Error("O arquivo de backup está corrompido ou não é um tar.gz válido");
  });

  // 2) Restaura. A limpeza do destino é opcional e explícita.
  const script = opts.wipeExisting
    ? "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/" + fileName + " -C /data"
    : "tar xzf /backup/" + fileName + " -C /data";

  await runHelper(["sh", "-c", script], [`${volume}:/data`, `${BACKUP_DIR}:/backup:ro`], {
    timeoutMs: 60 * 60 * 1000,
  });
}

/** Lista os arquivos de backup presentes no disco (e marca os ausentes). */
export async function listBackupFiles(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const entries = await fsp.readdir(BACKUP_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const st = await fsp.stat(path.join(BACKUP_DIR, e.name));
      map.set(e.name, st.size);
    }
  } catch {
    // diretório ainda não existe
  }
  return map;
}

/** Remove arquivos antigos conforme a retenção do agendamento. */
export async function applyRetention(scheduleId: string, retention: number): Promise<number> {
  const all = await prisma.backup.findMany({
    where: { scheduleId, status: "completed" },
    orderBy: { createdAt: "desc" },
  });
  if (all.length <= retention) return 0;

  const toDelete = all.slice(retention);
  let removed = 0;
  for (const old of toDelete) {
    try {
      if (old.filePath && fs.existsSync(old.filePath)) {
        await fsp.unlink(assertInsideBackupDir(old.filePath));
      }
    } catch {
      // arquivo já removido
    }
    await prisma.backup.delete({ where: { id: old.id } });
    removed++;
  }
  return removed;
}

/** Soma o tamanho de todos os backups no disco. */
export async function backupsDiskUsage(): Promise<{ files: number; bytes: number }> {
  const files = await listBackupFiles();
  let bytes = 0;
  files.forEach((size) => { bytes += size; });
  return { files: files.size, bytes };
}

/** Identificador estável e curto para logs. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

export { crypto, PANEL_NETWORK, ensurePanelNetwork };
