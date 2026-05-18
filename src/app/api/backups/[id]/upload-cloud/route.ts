import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { existsSync, statSync, createReadStream } from "fs";
import https from "https";
import http from "http";

async function uploadToGoogleDrive(
  filePath: string,
  fileName: string,
  accessToken: string,
  folder: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const fileStats = statSync(filePath);
    const metadata = JSON.stringify({
      name: fileName,
      parents: folder ? [folder] : undefined,
    });

    // Simple upload via multipart
    const boundary = "----CloudBackupBoundary" + Date.now();
    const metaPart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const endBoundary = `\r\n--${boundary}--`;

    const bodyLength = Buffer.byteLength(metaPart) + fileStats.size + Buffer.byteLength(filePart) + Buffer.byteLength(endBoundary);

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "www.googleapis.com",
          path: "/upload/drive/v3/files?uploadType=multipart",
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
            "Content-Length": bodyLength,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve({ success: true, fileId: parsed.id });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
            }
          });
        }
      );
      req.on("error", (err: Error) => resolve({ success: false, error: err.message }));
      req.write(metaPart);
      req.write(filePart);
      const stream = createReadStream(filePath);
      stream.on("data", (chunk: Buffer) => req.write(chunk));
      stream.on("end", () => {
        req.write(endBoundary);
        req.end();
      });
    });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

async function uploadToDropbox(
  filePath: string,
  fileName: string,
  accessToken: string,
  folder: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fileData = require("fs").readFileSync(filePath);
    const dropboxPath = `${folder || "/CoreByte-Backups"}/${fileName}`;

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "content.dropboxapi.com",
          path: "/2/files/upload",
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path: dropboxPath,
              mode: "add",
              autorename: true,
            }),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
            }
          });
        }
      );
      req.on("error", (err: Error) => resolve({ success: false, error: err.message }));
      req.write(fileData);
      req.end();
    });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

async function uploadToTerabox(
  filePath: string,
  fileName: string,
  accessToken: string,
  folder: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fileData = require("fs").readFileSync(filePath);
    const remotePath = `${folder || "/CoreByte-Backups"}/${fileName}`;

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "www.terabox.com",
          path: `/api/upload?access_token=${encodeURIComponent(accessToken)}&path=${encodeURIComponent(remotePath)}`,
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
            }
          });
        }
      );
      req.on("error", (err: Error) => resolve({ success: false, error: err.message }));
      req.write(fileData);
      req.end();
    });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { providerId } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId é obrigatório" }, { status: 400 });
    }

    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) {
      return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });
    }

    if (backup.status !== "completed") {
      return NextResponse.json({ error: "Backup ainda não completou" }, { status: 400 });
    }

    if (!existsSync(backup.filePath)) {
      return NextResponse.json({ error: "Arquivo de backup não encontrado no disco" }, { status: 404 });
    }

    const provider = await prisma.cloudProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      return NextResponse.json({ error: "Provider não encontrado" }, { status: 404 });
    }

    if (!provider.accessToken) {
      return NextResponse.json({ error: "Token de acesso não configurado" }, { status: 400 });
    }

    let result: { success: boolean; error?: string };

    switch (provider.type) {
      case "google_drive":
        result = await uploadToGoogleDrive(
          backup.filePath,
          backup.fileName,
          provider.accessToken,
          provider.folder || ""
        );
        break;
      case "dropbox":
        result = await uploadToDropbox(
          backup.filePath,
          backup.fileName,
          provider.accessToken,
          provider.folder || "/CoreByte-Backups"
        );
        break;
      case "terabox":
        result = await uploadToTerabox(
          backup.filePath,
          backup.fileName,
          provider.accessToken,
          provider.folder || "/CoreByte-Backups"
        );
        break;
      default:
        return NextResponse.json({ error: "Tipo de provider não suportado" }, { status: 400 });
    }

    if (result.success) {
      await prisma.cloudProvider.update({
        where: { id: providerId },
        data: { lastSync: new Date() },
      });
      return NextResponse.json({ ok: true, message: "Backup enviado para a nuvem com sucesso!" });
    } else {
      return NextResponse.json({ error: result.error || "Falha no upload" }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
