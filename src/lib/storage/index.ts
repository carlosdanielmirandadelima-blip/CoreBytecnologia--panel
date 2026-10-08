import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import {
  S3Client,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Client as FtpClient } from "basic-ftp";
import SftpClient from "ssh2-sftp-client";
import { Storage as MegaStorage } from "megajs";
import { buildEndpoint } from "./providers";

/** Pasta do MEGA (MutableFile) — tipagem local mínima. */
interface MutableFolder {
  upload(
    opts: { name: string },
    source: NodeJS.ReadableStream
  ): { complete: Promise<{ nodeId?: string } | undefined> };
  mkdir(opts: { name: string }): Promise<MutableFolder>;
  children?: {
    name?: string | null;
    nodeId?: string;
    directory: boolean;
    size?: number;
  }[];
}

/**
 * Adaptadores de armazenamento em nuvem.
 *
 * Cada adaptador recebe as credenciais já decifradas e expõe:
 *   test()     → valida as credenciais
 *   upload()   → envia o arquivo (sempre em streaming, para não estourar memória)
 *   download() → baixa de volta (usado na restauração a partir da nuvem)
 *   list()     → lista os arquivos na pasta remota
 */

export interface RemoteFile {
  name: string;
  path: string;
  size?: number;
}

export interface StorageAdapter {
  test(): Promise<string>;
  upload(localPath: string, remoteName: string): Promise<string>;
  download?(remotePath: string, localPath: string): Promise<void>;
  list?(): Promise<RemoteFile[]>;
}

export type StorageConfig = Record<string, string>;

/** Erro de configuração/credencial, mostrado ao usuário de forma amigável. */
export class StorageError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "StorageError";
  }
}

const MB = 1024 * 1024;

function joinRemote(folder: string | undefined, name: string): string {
  const base = (folder || "").trim().replace(/\/+$/, "");
  const clean = name.replace(/^\/+/, "");
  return base ? `${base}/${clean}` : clean;
}

async function fileSize(filePath: string): Promise<number> {
  const st = await fsp.stat(filePath);
  return st.size;
}

/** fetch com timeout, usado por todos os adaptadores HTTP. */
async function httpFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 120000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted")) throw new StorageError("Tempo esgotado ao falar com o serviço de nuvem");
    throw new StorageError(`Falha de rede: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 400);
  } catch {
    return "";
  }
}

/* ================================================================== */
/* S3 e compatíveis (AWS, R2, B2, Wasabi, MinIO, Spaces, Storj, ...)   */
/* ================================================================== */

class S3Adapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private folder: string;

  constructor(private providerId: string, private cfg: StorageConfig, folder?: string) {
    const endpoint = buildEndpoint(providerId, cfg);
    this.bucket = cfg.bucket;
    this.folder = folder || cfg.prefix || "";
    if (!this.bucket) throw new StorageError("Informe o bucket de destino");

    // Alguns serviços usam um padrão de endpoint montado a partir da região.
    const resolvedEndpoint = endpoint || (cfg.endpointTemplate
      ? cfg.endpointTemplate.replace("{region}", cfg.region || "us-east-1")
      : "");

    this.client = new S3Client({
      region: cfg.region || "us-east-1",
      ...(resolvedEndpoint ? { endpoint: resolvedEndpoint } : {}),
      forcePathStyle: cfg.forcePathStyle !== "false",
      credentials: {
        accessKeyId: cfg.accessKeyId || "",
        secretAccessKey: cfg.secretAccessKey || "",
      },
    });
  }

  async test(): Promise<string> {
    if (!this.cfg.accessKeyId || !this.cfg.secretAccessKey) {
      throw new StorageError("Informe Access Key ID e Secret Access Key");
    }
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    return `Bucket "${this.bucket}" acessível`;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const key = joinRemote(this.folder, remoteName);
    const stream = fs.createReadStream(localPath);
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: stream },
      queueSize: 4,
      partSize: 8 * MB,
      leavePartsOnError: false,
    });
    await upload.done();
    return `s3://${this.bucket}/${key}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const key = remotePath.startsWith("s3://")
      ? remotePath.replace(`s3://${this.bucket}/`, "")
      : joinRemote(this.folder, path.basename(remotePath));
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new StorageError("Objeto não encontrado na nuvem");
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, await res.Body.transformToByteArray());
  }

  async list(): Promise<RemoteFile[]> {
    const prefix = this.folder ? `${this.folder.replace(/\/+$/, "")}/` : "";
    const res = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, MaxKeys: 200 })
    );
    return (res.Contents || []).map((o) => ({
      name: path.basename(o.Key || ""),
      path: `s3://${this.bucket}/${o.Key}`,
      size: o.Size,
    }));
  }
}

/* ================================================================== */
/* Token OAuth com cache (Google, OneDrive, Dropbox, Box)              */
/* ================================================================== */

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

async function getOAuthToken(
  cacheKey: string,
  tokenUrl: string,
  params: Record<string, string>
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const res = await httpFetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    throw new StorageError(
      "Não foi possível renovar o token de acesso",
      `${res.status}: ${await readError(res)}`
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new StorageError("Resposta de token inválida");
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

/* ================================================================== */
/* Google Drive (OAuth refresh token ou service account)               */
/* ================================================================== */

/** Assina um JWT RS256 manualmente (sem dependência extra). */
function signJwt(payload: Record<string, unknown>, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const sig = signer.sign(privateKey).toString("base64url");
  return `${signingInput}.${sig}`;
}

class GoogleDriveAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async accessToken(): Promise<string> {
    if (this.cfg.serviceAccountJson) {
      let sa: { client_email?: string; private_key?: string; token_uri?: string };
      try {
        sa = JSON.parse(this.cfg.serviceAccountJson);
      } catch {
        throw new StorageError("O JSON da service account é inválido");
      }
      if (!sa.client_email || !sa.private_key) {
        throw new StorageError("O JSON da service account não tem client_email/private_key");
      }
      const now = Math.floor(Date.now() / 1000);
      const assertion = signJwt(
        {
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/drive.file",
          aud: sa.token_uri || "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        },
        sa.private_key
      );
      return getOAuthToken(
        `gdrive-sa:${sa.client_email}`,
        sa.token_uri || "https://oauth2.googleapis.com/token",
        { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }
      );
    }

    if (this.cfg.refreshToken && this.cfg.clientId && this.cfg.clientSecret) {
      return getOAuthToken(`gdrive:${this.cfg.clientId}`, "https://oauth2.googleapis.com/token", {
        grant_type: "refresh_token",
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        refresh_token: this.cfg.refreshToken,
      });
    }

    if (this.cfg.accessToken) return this.cfg.accessToken;
    throw new StorageError(
      "Credenciais do Google Drive incompletas. Use o JSON da service account ou informe Client ID, Client Secret e Refresh Token."
    );
  }

  async test(): Promise<string> {
    const token = await this.accessToken();
    const res = await httpFetch(
      "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new StorageError("Google Drive recusou as credenciais", await readError(res));
    const j = (await res.json()) as { user?: { emailAddress?: string } };
    return `Conectado como ${j.user?.emailAddress ?? "conta Google"}`;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const token = await this.accessToken();
    const size = await fileSize(localPath);
    const metadata: Record<string, unknown> = { name: remoteName };
    if (this.cfg.folderId) metadata.parents = [this.cfg.folderId];

    // Sessão de upload resumível: necessária para arquivos grandes.
    const init = await httpFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/octet-stream",
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!init.ok) throw new StorageError("Falha ao iniciar upload no Google Drive", await readError(init));
    const sessionUrl = init.headers.get("location");
    if (!sessionUrl) throw new StorageError("O Google Drive não retornou a URL de upload");

    const res = await httpFetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
      body: fs.createReadStream(localPath) as unknown as ReadableStream,
      duplex: "half",
      timeoutMs: 30 * 60 * 1000,
    } as RequestInit & { duplex: string; timeoutMs: number });

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      throw new StorageError("Falha no upload para o Google Drive", await readError(res));
    }
    const info = (await res.json().catch(() => ({}))) as { id?: string };
    return info.id ? `gdrive:${info.id}` : `gdrive:${remoteName}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const token = await this.accessToken();
    const fileId = remotePath.replace(/^gdrive:/, "");
    const res = await httpFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 30 * 60 * 1000 }
    );
    if (!res.ok) throw new StorageError("Falha ao baixar do Google Drive", await readError(res));
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }

  async list(): Promise<RemoteFile[]> {
    const token = await this.accessToken();
    const q = this.cfg.folderId ? `'${this.cfg.folderId}' in parents and trashed=false` : "trashed=false";
    const res = await httpFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size)&pageSize=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { files?: { id: string; name: string; size?: string }[] };
    return (j.files || []).map((f) => ({
      name: f.name,
      path: `gdrive:${f.id}`,
      size: f.size ? Number(f.size) : undefined,
    }));
  }
}

/* ================================================================== */
/* Microsoft OneDrive (Microsoft Graph)                                 */
/* ================================================================== */

class OneDriveAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async token(): Promise<string> {
    if (this.cfg.refreshToken && this.cfg.clientId && this.cfg.clientSecret) {
      return getOAuthToken(
        `onedrive:${this.cfg.clientId}`,
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          grant_type: "refresh_token",
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          refresh_token: this.cfg.refreshToken,
          scope: "offline_access Files.ReadWrite.All",
        }
      );
    }
    if (this.cfg.accessToken) return this.cfg.accessToken;
    throw new StorageError("Informe Client ID, Client Secret e Refresh Token do OneDrive");
  }

  private remotePath(name: string): string {
    const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
    return `${base}/${name}`;
  }

  private url(remotePath: string): string {
    const clean = remotePath.startsWith("/") ? remotePath : `/${remotePath}`;
    return `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(clean)}`;
  }

  async test(): Promise<string> {
    const t = await this.token();
    const res = await httpFetch("https://graph.microsoft.com/v1.0/me/drive", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new StorageError("OneDrive recusou as credenciais", await readError(res));
    const j = (await res.json()) as { owner?: { user?: { displayName?: string } } };
    return `Conectado como ${j.owner?.user?.displayName ?? "conta Microsoft"}`;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const t = await this.token();
    const target = this.remotePath(remoteName);
    const size = await fileSize(localPath);
    const endpoint = this.url(target);

    // Até 250 MB vai direto; acima disso usamos sessão de upload em blocos.
    if (size <= 250 * MB) {
      const res = await httpFetch(`${endpoint}:/content`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/octet-stream" },
        body: fs.createReadStream(localPath) as unknown as ReadableStream,
        duplex: "half",
        timeoutMs: 30 * 60 * 1000,
      } as RequestInit & { duplex: string; timeoutMs: number });
      if (!res.ok) throw new StorageError("Falha no upload para o OneDrive", await readError(res));
      return `onedrive:${target}`;
    }

    const session = await httpFetch(`${endpoint}:/createUploadSession`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace", name: remoteName } }),
    });
    if (!session.ok) throw new StorageError("Falha ao criar sessão de upload", await readError(session));
    const { uploadUrl } = (await session.json()) as { uploadUrl: string };

    const chunkSize = 10 * MB;
    const handle = await fsp.open(localPath, "r");
    try {
      for (let offset = 0; offset < size; offset += chunkSize) {
        const len = Math.min(chunkSize, size - offset);
        const buf = Buffer.alloc(len);
        await handle.read(buf, 0, len, offset);
        const res = await httpFetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Length": String(len),
            "Content-Range": `bytes ${offset}-${offset + len - 1}/${size}`,
          },
          body: buf,
          timeoutMs: 10 * 60 * 1000,
        });
        if (!res.ok && res.status !== 202) {
          throw new StorageError("Falha no envio em blocos ao OneDrive", await readError(res));
        }
      }
    } finally {
      await handle.close();
    }
    return `onedrive:${target}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const t = await this.token();
    const clean = remotePath.replace(/^onedrive:/, "");
    const res = await httpFetch(`${this.url(clean)}:/content`, {
      headers: { Authorization: `Bearer ${t}` },
      timeoutMs: 30 * 60 * 1000,
    });
    if (!res.ok) throw new StorageError("Falha ao baixar do OneDrive", await readError(res));
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }
}

/* ================================================================== */
/* Dropbox                                                              */
/* ================================================================== */

class DropboxAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async token(): Promise<string> {
    if (this.cfg.refreshToken && this.cfg.appKey && this.cfg.appSecret) {
      return getOAuthToken("dropbox", "https://api.dropboxapi.com/oauth2/token", {
        grant_type: "refresh_token",
        refresh_token: this.cfg.refreshToken,
        client_id: this.cfg.appKey,
        client_secret: this.cfg.appSecret,
      });
    }
    if (this.cfg.accessToken) return this.cfg.accessToken;
    throw new StorageError("Informe App Key, App Secret e Refresh Token (ou um access token)");
  }

  private remotePath(name: string): string {
    const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
    return `${base}/${name}`;
  }

  async test(): Promise<string> {
    const t = await this.token();
    const res = await httpFetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new StorageError("Dropbox recusou as credenciais", await readError(res));
    const j = (await res.json()) as { email?: string; name?: { display_name?: string } };
    return `Conectado como ${j.name?.display_name ?? j.email ?? "conta Dropbox"}`;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const t = await this.token();
    const target = this.remotePath(remoteName);
    const size = await fileSize(localPath);

    // Até ~140 MB: upload simples. Acima: sessão de upload em blocos.
    if (size <= 140 * MB) {
      const res = await httpFetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: target,
            mode: "overwrite",
            autorename: true,
            mute: true,
          }),
        },
        body: fs.createReadStream(localPath) as unknown as ReadableStream,
        duplex: "half",
        timeoutMs: 30 * 60 * 1000,
      } as RequestInit & { duplex: string; timeoutMs: number });
      if (!res.ok) throw new StorageError("Falha no upload para o Dropbox", await readError(res));
      return `dropbox:${target}`;
    }

    const chunk = 8 * MB;
    let offset = 0;
    const handle = await fsp.open(localPath, "r");
    try {
      // Primeiro bloco inicia a sessão.
      const firstLen = Math.min(chunk, size);
      const first = Buffer.alloc(firstLen);
      await handle.read(first, 0, firstLen, 0);
      offset = firstLen;

      const start = await httpFetch("https://content.dropboxapi.com/2/files/upload_session/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ close: false }),
        },
        body: first,
      });
      if (!start.ok) throw new StorageError("Falha ao iniciar sessão no Dropbox", await readError(start));
      const { session_id } = (await start.json()) as { session_id: string };

      while (offset < size) {
        const len = Math.min(chunk, size - offset);
        const buf = Buffer.alloc(len);
        await handle.read(buf, 0, len, offset);
        const isLast = offset + len >= size;
        const url = isLast
          ? "https://content.dropboxapi.com/2/files/upload_session/finish"
          : "https://content.dropboxapi.com/2/files/upload_session/append_v2";
        const arg = isLast
          ? { cursor: { session_id, offset }, commit: { path: target, mode: "overwrite", autorename: true, mute: true } }
          : { cursor: { session_id, offset }, close: false };
        const res = await httpFetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify(arg),
          },
          body: buf,
          timeoutMs: 10 * 60 * 1000,
        });
        if (!res.ok) throw new StorageError("Falha no envio em blocos ao Dropbox", await readError(res));
        offset += len;
      }
    } finally {
      await handle.close();
    }
    return `dropbox:${target}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const t = await this.token();
    const clean = remotePath.replace(/^dropbox:/, "");
    const res = await httpFetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Dropbox-API-Arg": JSON.stringify({ path: clean }) },
      timeoutMs: 30 * 60 * 1000,
    });
    if (!res.ok) throw new StorageError("Falha ao baixar do Dropbox", await readError(res));
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }
}

/* ================================================================== */
/* Box                                                                  */
/* ================================================================== */

class BoxAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async token(): Promise<string> {
    if (this.cfg.refreshToken && this.cfg.clientId && this.cfg.clientSecret) {
      return getOAuthToken("box", "https://api.box.com/oauth2/token", {
        grant_type: "refresh_token",
        refresh_token: this.cfg.refreshToken,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
      });
    }
    if (this.cfg.accessToken) return this.cfg.accessToken;
    throw new StorageError("Informe Client ID, Client Secret e Refresh Token do Box");
  }

  async test(): Promise<string> {
    const t = await this.token();
    const res = await httpFetch("https://api.box.com/2.0/users/me", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new StorageError("Box recusou as credenciais", await readError(res));
    const j = (await res.json()) as { name?: string; login?: string };
    return `Conectado como ${j.name ?? j.login ?? "conta Box"}`;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const t = await this.token();
    const parentId = this.cfg.folderId || "0";
    const size = await fileSize(localPath);
    const attributes = { name: remoteName, parent: { id: parentId } };

    // Até 50 MB: upload direto. Acima: upload em sessão.
    if (size <= 50 * MB) {
      const form = new FormData();
      form.append("attributes", JSON.stringify(attributes));
      form.append(
        "file",
        new Blob([await fsp.readFile(localPath)]),
        remoteName
      );
      const res = await httpFetch("https://upload.box.com/api/2.0/files/content", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
        body: form,
        timeoutMs: 30 * 60 * 1000,
      });
      if (!res.ok) throw new StorageError("Falha no upload para o Box", await readError(res));
      const j = (await res.json()) as { entries?: { id: string }[] };
      return `box:${j.entries?.[0]?.id ?? remoteName}`;
    }

    const session = await httpFetch("https://upload.box.com/api/2.0/files/upload_sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: parentId, file_size: size, file_name: remoteName }),
    });
    if (!session.ok) throw new StorageError("Falha ao criar sessão no Box", await readError(session));
    const s = (await session.json()) as { id: string; part_size: number; session_endpoints?: { commit?: string } };
    const partSize = s.part_size || 8 * MB;

    const handle = await fsp.open(localPath, "r");
    const parts: { part_id: string; offset: number; size: number }[] = [];
    try {
      for (let offset = 0; offset < size; offset += partSize) {
        const len = Math.min(partSize, size - offset);
        const buf = Buffer.alloc(len);
        await handle.read(buf, 0, len, offset);
        // Box usa SHA-1 da parte no header Digest.
        const digest = crypto.createHash("sha1").update(buf).digest("base64");
        const res = await httpFetch(`https://upload.box.com/api/2.0/files/upload_sessions/${s.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${t}`,
            "Content-Type": "application/octet-stream",
            Digest: `sha-1=${digest}`,
            "Content-Range": `bytes ${offset}-${offset + len - 1}/${size}`,
          },
          body: buf,
          timeoutMs: 10 * 60 * 1000,
        });
        if (!res.ok) throw new StorageError("Falha no envio em blocos ao Box", await readError(res));
        const jr = (await res.json()) as { part?: { part_id: string; offset: number; size: number } };
        if (jr.part) parts.push(jr.part);
      }
    } finally {
      await handle.close();
    }

    const commitBody = JSON.stringify({ parts });
    const commitRes = await httpFetch(
      s.session_endpoints?.commit || `https://upload.box.com/api/2.0/files/upload_sessions/${s.id}/commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
          Digest: `sha-1=${crypto.createHash("sha1").update(commitBody).digest("base64")}`,
        },
        body: commitBody,
      }
    );
    if (!commitRes.ok) throw new StorageError("Falha ao finalizar upload no Box", await readError(commitRes));
    const done = (await commitRes.json()) as { entries?: { id: string }[] };
    return `box:${done.entries?.[0]?.id ?? remoteName}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const t = await this.token();
    const id = remotePath.replace(/^box:/, "");
    const res = await httpFetch(`https://api.box.com/2.0/files/${id}/content`, {
      headers: { Authorization: `Bearer ${t}` },
      timeoutMs: 30 * 60 * 1000,
    });
    if (!res.ok) throw new StorageError("Falha ao baixar do Box", await readError(res));
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }
}

/* ================================================================== */
/* WebDAV (Nextcloud, ownCloud, genérico)                              */
/* ================================================================== */

class WebDavAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private get base(): string {
    // Alguns clientes informam a pasta junto da URL; garantimos a base.
    return (this.cfg.url || "").replace(/\/+$/, "");
  }

  private authHeader(): Record<string, string> {
    if (!this.cfg.username) return {};
    const raw = `${this.cfg.username}:${this.cfg.password || ""}`;
    return { Authorization: `Basic ${Buffer.from(raw).toString("base64")}` };
  }

  private remote(name: string): string {
    const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/^\/+/, "");
    return `${this.base}/${base}/${name}`;
  }

  private async ensureFolder(dir: string): Promise<void> {
    const res = await httpFetch(dir, { method: "MKCOL", headers: this.authHeader() });
    // 405 = já existe; 409 = pasta pai ausente (criamos recursivamente antes).
    if (res.status === 409) {
      const parent = dir.replace(/\/[^/]+$/, "");
      if (parent && parent !== dir && parent.length > this.base.length) {
        await this.ensureFolder(parent);
      }
      await httpFetch(dir, { method: "MKCOL", headers: this.authHeader() });
    }
  }

  async test(): Promise<string> {
    if (!this.cfg.url) throw new StorageError("Informe a URL do WebDAV");
    const res = await httpFetch(this.base + "/", {
      method: "PROPFIND",
      headers: { ...this.authHeader(), Depth: "0" },
    });
    if (res.status === 401) throw new StorageError("Usuário ou senha do WebDAV incorretos");
    if (!res.ok && res.status !== 207) {
      throw new StorageError("O servidor WebDAV não respondeu como esperado", `HTTP ${res.status}`);
    }
    return "Servidor WebDAV respondeu corretamente";
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const folderRel = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/^\/+/, "");
    await this.ensureFolder(`${this.base}/${folderRel}`);
    const target = this.remote(remoteName);
    const size = await fileSize(localPath);
    const res = await httpFetch(target, {
      method: "PUT",
      headers: {
        ...this.authHeader(),
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
      },
      body: fs.createReadStream(localPath) as unknown as ReadableStream,
      duplex: "half",
      timeoutMs: 30 * 60 * 1000,
    } as RequestInit & { duplex: string; timeoutMs: number });
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new StorageError("Falha no upload via WebDAV", await readError(res));
    }
    return `webdav:${target}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const clean = remotePath.replace(/^webdav:/, "");
    const res = await httpFetch(clean, {
      headers: this.authHeader(),
      timeoutMs: 30 * 60 * 1000,
    });
    if (!res.ok) throw new StorageError("Falha ao baixar via WebDAV", await readError(res));
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }

  async list(): Promise<RemoteFile[]> {
    const folderRel = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/^\/+/, "");
    const res = await httpFetch(`${this.base}/${folderRel}`, {
      method: "PROPFIND",
      headers: { ...this.authHeader(), Depth: "1" },
    });
    if (!res.ok && res.status !== 207) return [];
    const xml = await res.text();
    const files: RemoteFile[] = [];
    for (const m of Array.from(xml.matchAll(/<d:href>([^<]+)<\/d:href>/gi))) {
      const href = decodeURIComponent(m[1]);
      const name = href.replace(/\/+$/, "").split("/").pop() || "";
      if (name && name !== folderRel.split("/").pop()) {
        files.push({ name, path: `webdav:${href}` });
      }
    }
    return files.slice(0, 200);
  }
}

/* ================================================================== */
/* FTP / FTPS                                                          */
/* ================================================================== */

class FtpAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async connect(): Promise<FtpClient> {
    const client = new FtpClient();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: this.cfg.host,
        port: Number(this.cfg.port) || 21,
        user: this.cfg.username,
        password: this.cfg.password,
        secure: this.cfg.secure !== "false",
        secureOptions: { rejectUnauthorized: false },
      });
      return client;
    } catch (e) {
      client.close();
      throw new StorageError("Não foi possível conectar ao FTP", e instanceof Error ? e.message : undefined);
    }
  }

  private remote(name: string): string {
    const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
    return `${base}/${name}`;
  }

  async test(): Promise<string> {
    const client = await this.connect();
    try {
      const pwd = await client.pwd();
      return `Conectado ao FTP (diretório atual: ${pwd})`;
    } finally {
      client.close();
    }
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const client = await this.connect();
    try {
      const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
      await client.ensureDir(base);
      await client.uploadFrom(localPath, remoteName);
      return `ftp:${this.remote(remoteName)}`;
    } catch (e) {
      throw new StorageError("Falha no upload via FTP", e instanceof Error ? e.message : undefined);
    } finally {
      client.close();
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const client = await this.connect();
    try {
      const clean = remotePath.replace(/^ftp:/, "");
      await fsp.mkdir(path.dirname(localPath), { recursive: true });
      await client.downloadTo(localPath, path.basename(clean));
    } finally {
      client.close();
    }
  }
}

/* ================================================================== */
/* SFTP                                                                */
/* ================================================================== */

class SftpAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private options() {
    const opts: Record<string, unknown> = {
      host: this.cfg.host,
      port: Number(this.cfg.port) || 22,
      username: this.cfg.username,
      readyTimeout: 20000,
    };
    if (this.cfg.privateKey) {
      opts.privateKey = this.cfg.privateKey;
      if (this.cfg.passphrase) opts.passphrase = this.cfg.passphrase;
    } else {
      opts.password = this.cfg.password;
    }
    return opts;
  }

  private remote(name: string): string {
    const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
    return `${base}/${name}`;
  }

  async test(): Promise<string> {
    const sftp = new SftpClient();
    try {
      await sftp.connect(this.options());
      return `Conectado via SFTP a ${this.cfg.host}`;
    } catch (e) {
      throw new StorageError("Não foi possível conectar via SFTP", e instanceof Error ? e.message : undefined);
    } finally {
      await sftp.end().catch(() => {});
    }
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const sftp = new SftpClient();
    try {
      await sftp.connect(this.options());
      const base = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/\/+$/, "");
      await sftp.mkdir(base, true).catch(() => {});
      await sftp.fastPut(localPath, `${base}/${remoteName}`);
      return `sftp:${this.remote(remoteName)}`;
    } catch (e) {
      throw new StorageError("Falha no upload via SFTP", e instanceof Error ? e.message : undefined);
    } finally {
      await sftp.end().catch(() => {});
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const sftp = new SftpClient();
    try {
      await sftp.connect(this.options());
      const clean = remotePath.replace(/^sftp:/, "");
      await fsp.mkdir(path.dirname(localPath), { recursive: true });
      await sftp.fastGet(clean, localPath);
    } finally {
      await sftp.end().catch(() => {});
    }
  }
}

/* ================================================================== */
/* MEGA                                                                 */
/* ================================================================== */

class MegaAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async login(): Promise<MegaStorage> {
    if (!this.cfg.email || !this.cfg.password) {
      throw new StorageError("Informe e-mail e senha da conta MEGA");
    }
    try {
      return await new MegaStorage({ email: this.cfg.email, password: this.cfg.password }).ready;
    } catch (e) {
      throw new StorageError("Não foi possível entrar no MEGA", e instanceof Error ? e.message : undefined);
    }
  }

  async test(): Promise<string> {
    const storage = await this.login();
    try {
      const name = (storage as unknown as { name?: string }).name;
      return `Conectado ao MEGA${name ? ` (${name})` : ""}`;
    } finally {
      storage.close();
    }
  }

  /**
   * Localiza (ou cria) a pasta remota, criando subpastas quando necessário.
   * O `root` do megajs é um MutableFile; `find` só existe em File, por isso
   * navegamos pelos filhos explicitamente.
   */
  private async resolveFolder(storage: MegaStorage): Promise<MutableFolder> {
    const rel = (this.folder || this.cfg.folder || "/CoreByte-Backups").replace(/^\/+|\/+$/g, "");
    if (!rel) return storage.root as unknown as MutableFolder;

    let current = storage.root as unknown as MutableFolder;
    for (const part of rel.split("/").filter(Boolean)) {
      const existing = current.children?.find((c) => c.name === part && c.directory);
      current = (existing as unknown as MutableFolder | undefined) ??
        ((await current.mkdir({ name: part })) as MutableFolder);
    }
    return current;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const storage = await this.login();
    try {
      const folder = await this.resolveFolder(storage);
      // upload() devolve um stream com a promessa `complete`.
      const stream = folder.upload({ name: remoteName }, fs.createReadStream(localPath));
      const done = await stream.complete;
      return `mega:${done?.nodeId ?? remoteName}`;
    } catch (e) {
      throw new StorageError("Falha no upload para o MEGA", e instanceof Error ? e.message : undefined);
    } finally {
      storage.close();
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const storage = await this.login();
    try {
      const id = remotePath.replace(/^mega:/, "");
      const folder = await this.resolveFolder(storage);
      const file = (folder.children ?? []).find((c) => c.nodeId === id && !c.directory);
      if (!file) throw new StorageError("Arquivo não encontrado no MEGA");
      const buf = await (file as unknown as { downloadBuffer: (o: object) => Promise<Buffer> })
        .downloadBuffer({});
      await fsp.mkdir(path.dirname(localPath), { recursive: true });
      await fsp.writeFile(localPath, buf);
    } finally {
      storage.close();
    }
  }

  async list(): Promise<RemoteFile[]> {
    const storage = await this.login();
    try {
      const folder = await this.resolveFolder(storage);
      return (folder.children ?? [])
        .filter((c) => !c.directory)
        .slice(0, 200)
        .map((c) => ({
          name: c.name ?? "",
          path: `mega:${c.nodeId}`,
          size: typeof c.size === "number" ? c.size : undefined,
        }));
    } finally {
      storage.close();
    }
  }
}

/* ================================================================== */
/* pCloud                                                              */
/* ================================================================== */

class PCloudAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private get host(): string {
    return this.cfg.region || "api.pcloud.com";
  }

  private async call(method: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({ ...params, auth: this.cfg.authToken });
    const res = await httpFetch(`https://${this.host}/${method}?${qs.toString()}`);
    const json = (await res.json()) as { result: number; error?: string; [k: string]: unknown };
    if (json.result !== 0) {
      throw new StorageError(`pCloud respondeu com erro: ${json.error ?? json.result}`, JSON.stringify(json).slice(0, 200));
    }
    return json;
  }

  async test(): Promise<string> {
    if (!this.cfg.authToken) throw new StorageError("Informe o token da API do pCloud");
    const j = await this.call("userinfo", {});
    return `Conectado como ${(j.email as string) ?? "conta pCloud"}`;
  }

  private async folderId(create: boolean): Promise<number> {
    const base = this.folder || this.cfg.folder || "/CoreByte-Backups";
    if (create) {
      const j = await this.call("createfolderifnotexists", { path: base, folderid: "0" });
      return Number(j.metadata && (j.metadata as { folderid: number }).folderid) || 0;
    }
    const j = await this.call("listfolder", { path: base, folderid: "0" });
    return Number(j.metadata && (j.metadata as { folderid: number }).folderid) || 0;
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const folderid = await this.folderId(true);
    const size = await fileSize(localPath);
    const start = await this.call("upload_create", {
      folderid: String(folderid),
      filename: remoteName,
      filesize: String(size),
    });
    const uploadId = start.uploadid as number;
    const offset = Number(start.offset) || 0;

    const handle = await fsp.open(localPath, "r");
    try {
      let pos = offset;
      const chunk = 8 * MB;
      while (pos < size) {
        const len = Math.min(chunk, size - pos);
        const buf = Buffer.alloc(len);
        await handle.read(buf, 0, len, pos);
        const res = await httpFetch(
          `https://${this.host}/upload_write?uploadid=${uploadId}&offset=${pos}`,
          { method: "PUT", body: buf, timeoutMs: 10 * 60 * 1000 }
        );
        if (!res.ok) throw new StorageError("Falha no envio em blocos ao pCloud", await readError(res));
        pos += len;
      }
      await this.call("upload_save", { uploadid: String(uploadId), folderid: String(folderid), filename: remoteName });
    } finally {
      await handle.close();
    }
    return `pcloud:${remoteName}`;
  }
}

/* ================================================================== */
/* TeraBox (API web, requer cookie de sessão)                          */
/* ================================================================== */

class TeraBoxAdapter implements StorageAdapter {
  constructor(private cfg: StorageConfig, private folder?: string) {}

  private async api(pathname: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await httpFetch(`https://www.terabox.com${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.cfg.cookie || "",
        "User-Agent": "Mozilla/5.0 (compatible; CoreBytePanel/1.0)",
      },
      body: new URLSearchParams(
        Object.entries({ ...body, app_id: "250528", web: "1" }).map(([k, v]) => [k, String(v)])
      ).toString(),
    });
    if (!res.ok) throw new StorageError("Falha ao falar com o TeraBox", `HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async test(): Promise<string> {
    if (!this.cfg.cookie) throw new StorageError("Informe o cookie de sessão do TeraBox");
    const j = await this.api("/api/user/getinfo", {});
    const errno = Number(j.errno ?? -1);
    if (errno !== 0) {
      throw new StorageError(
        "O TeraBox recusou a sessão (cookie expirado?)",
        `errno=${errno}`
      );
    }
    return "Sessão do TeraBox válida";
  }

  async upload(localPath: string, remoteName: string): Promise<string> {
    const init = await this.api("/api/create", {
      path: `${this.folder || this.cfg.folder || "/CoreByte-Backups"}/${remoteName}`,
      isdir: "0",
      size: String(await fileSize(localPath)),
      block_list: JSON.stringify([]),
      autoinit: "1",
    });
    if (Number(init.errno ?? -1) !== 0) {
      throw new StorageError("TeraBox não permitiu iniciar o upload", JSON.stringify(init).slice(0, 200));
    }
    const params = init as { uploadid?: string; server?: string; blockList?: number[] };
    const server = (params.server || "").replace(/^https?:/, "https:");
    const uploadId = params.uploadid;

    const form = new FormData();
    form.append("file", new Blob([await fsp.readFile(localPath)]), remoteName);
    const res = await httpFetch(`${server}/rest/2.0/pcs/file?method=upload&app_id=250528&uploadid=${uploadId}&path=${encodeURIComponent(remoteName)}`, {
      method: "POST",
      headers: { Cookie: this.cfg.cookie || "" },
      body: form,
      timeoutMs: 30 * 60 * 1000,
    });
    if (!res.ok) throw new StorageError("Falha no upload para o TeraBox", await readError(res));
    const out = (await res.json()) as Record<string, unknown>;
    if (out.error_code !== undefined && Number(out.error_code) !== 0) {
      throw new StorageError("TeraBox recusou o arquivo", JSON.stringify(out).slice(0, 200));
    }
    await this.api("/api/create", {
      path: `${this.folder || this.cfg.folder || "/CoreByte-Backups"}/${remoteName}`,
      isdir: "0",
      size: String(await fileSize(localPath)),
      uploadid: String(uploadId),
      block_list: JSON.stringify(out.block_list ?? []),
    });
    return `terabox:${remoteName}`;
  }
}

/* ================================================================== */
/* Fábrica                                                              */
/* ================================================================== */

export function createAdapter(
  type: string,
  cfg: StorageConfig,
  folder?: string,
  providerId?: string
): StorageAdapter {
  const id = providerId || type;
  switch (type) {
    case "s3":
      return new S3Adapter(id, cfg, folder);
    case "google_drive":
      return new GoogleDriveAdapter(cfg, folder);
    case "onedrive":
      return new OneDriveAdapter(cfg, folder);
    case "dropbox":
      return new DropboxAdapter(cfg, folder);
    case "box":
      return new BoxAdapter(cfg, folder);
    case "webdav":
      return new WebDavAdapter(cfg, folder);
    case "ftp":
      return new FtpAdapter(cfg, folder);
    case "sftp":
      return new SftpAdapter(cfg, folder);
    case "mega":
      return new MegaAdapter(cfg, folder);
    case "pcloud":
      return new PCloudAdapter(cfg, folder);
    case "terabox":
      return new TeraBoxAdapter(cfg, folder);
    default:
      throw new StorageError(`Tipo de armazenamento não suportado: ${type}`);
  }
}

/** Normaliza mensagens de erro para exibição na interface. */
export function describeError(e: unknown): string {
  if (e instanceof StorageError) {
    return e.detail ? `${e.message} (${e.detail})` : e.message;
  }
  if (e instanceof Error) {
    const m = e.message;
    if (m.includes("ENOTFOUND")) return "Servidor não encontrado (verifique o host/endpoint)";
    if (m.includes("ECONNREFUSED")) return "Conexão recusada pelo servidor";
    if (m.includes("InvalidAccessKeyId") || m.includes("SignatureDoesNotMatch")) return "Credenciais inválidas";
    if (m.includes("NoSuchBucket")) return "O bucket informado não existe";
    if (m.includes("AccessDenied")) return "Acesso negado (verifique as permissões da chave)";
    return m.slice(0, 300);
  }
  return "Erro desconhecido";
}

export { Readable };
