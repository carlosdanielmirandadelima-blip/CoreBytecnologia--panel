"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ProviderForm,
  ProviderPicker,
  ProviderIcon,
  type ProviderDef,
} from "@/components/backups/cloud-provider-form";

/**
 * Aba de Backups.
 *
 * Passou a trabalhar com o catálogo completo de serviços de nuvem
 * (Google Drive, OneDrive, Dropbox, Box, Amazon S3, Cloudflare R2,
 * Backblaze, Wasabi, MinIO, DigitalOcean, Storj, pCloud, MEGA, WebDAV,
 * Nextcloud, FTP e SFTP) com formulário de credenciais próprio para cada um,
 * teste de conexão e restauração a partir da nuvem.
 */

interface Backup {
  id: string;
  name: string;
  type: string;
  source: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  cloudProviderId?: string | null;
  remotePath?: string;
  uploadedAt?: string | null;
  existsOnDisk?: boolean;
}

interface Schedule {
  id: string;
  name: string;
  type: string;
  source: string;
  cron: string;
  retention: number;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

interface Volume {
  name: string;
  driver: string;
}

interface CloudProvider {
  id: string;
  name: string;
  type: string;
  typeName: string;
  folder: string | null;
  enabled: boolean;
  autoBackup: boolean;
  autoFrequency: string;
  lastSync: string | null;
  lastError: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function describeCron(expr: string): string {
  const p = expr.trim().split(/\s+/);
  if (p.length !== 5) return expr;
  const [m, h, dom, mon, dow] = p;
  if (m.startsWith("*/") && h === "*") return `A cada ${m.slice(2)} minuto(s)`;
  if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
    const time = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    if (dom === "*" && mon === "*" && dow === "*") return `Todos os dias às ${time}`;
    if (dow === "1-5") return `Dias úteis às ${time}`;
    return `${expr} (${time})`;
  }
  return expr;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    pending: "bg-white/10 text-white/50 border-white/20",
  };
  const label: Record<string, string> = {
    completed: "Concluído",
    running: "Em andamento",
    failed: "Falhou",
    pending: "Pendente",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {label[status] ?? status}
    </span>
  );
}

export default function BackupsPage() {
  const [tab, setTab] = useState<"backups" | "schedules" | "cloud">("backups");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [catalog, setCatalog] = useState<ProviderDef[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<ProviderDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [showNewBackup, setShowNewBackup] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [backupType, setBackupType] = useState("volume");
  const [backupSource, setBackupSource] = useState("");

  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [schName, setSchName] = useState("");
  const [schType, setSchType] = useState("volume");
  const [schSource, setSchSource] = useState("");
  const [schCron, setSchCron] = useState("0 2 * * *");
  const [schRetention, setSchRetention] = useState(7);
  const [schCloud, setSchCloud] = useState("");

  const [uploadTarget, setUploadTarget] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, vRes, cRes] = await Promise.all([
        fetch("/api/backups"),
        fetch("/api/backups/schedules"),
        fetch("/api/volumes"),
        fetch("/api/cloud-providers"),
      ]);
      if (bRes.ok) setBackups(await bRes.json());
      if (sRes.ok) setSchedules(await sRes.json());
      if (vRes.ok) {
        const v = await vRes.json();
        setVolumes(Array.isArray(v) ? v : v.volumes ?? []);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        setProviders(d.providers ?? []);
        setCatalog(d.catalog ?? []);
      }
    } catch {
      toast.error("Não foi possível carregar os dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* --------------------------- ações --------------------------- */

  const createBackup = async () => {
    if (!backupName.trim() || !backupSource.trim()) {
      toast.error("Informe o nome e a origem");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: backupName, type: backupType, source: backupSource }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("Backup concluído");
        setShowNewBackup(false);
        setBackupName("");
        setBackupSource("");
        fetchData();
      } else {
        toast.error(d.error ?? "Falha ao criar backup");
      }
    } finally {
      setSaving(false);
    }
  };

  const createSchedule = async () => {
    if (!schName.trim() || !schSource.trim()) {
      toast.error("Informe o nome e a origem");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/backups/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: schName,
          type: schType,
          source: schSource,
          cron: schCron,
          retention: schRetention,
          cloudDestination: schCloud,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("Agendamento criado");
        setShowNewSchedule(false);
        setSchName("");
        setSchSource("");
        fetchData();
      } else {
        toast.error(d.error ?? "Falha ao criar agendamento");
      }
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (config: Record<string, string>, folder: string) => {
    if (!selected) return;
    const res = await fetch("/api/cloud-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selected.id, config, folder }),
    });
    const d = await res.json();
    if (d.ok) toast.success(d.message ?? "Conexão bem-sucedida");
    else toast.error(d.error ?? "Falha na conexão");
  };

  const saveProvider = async (data: {
    name: string;
    folder: string;
    config: Record<string, string>;
    autoBackup: boolean;
    autoFrequency: string;
  }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cloud-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected.id, ...data }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`${data.name} conectado`);
        setSelected(null);
        fetchData();
      } else {
        toast.error(d.error ?? "Falha ao salvar");
      }
    } finally {
      setSaving(false);
    }
  };

  const retestProvider = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/cloud-providers/${id}`, { method: "POST" });
      const d = await res.json();
      if (d.ok) toast.success(d.message ?? "Conexão bem-sucedida");
      else toast.error(d.error ?? "Falha na conexão");
      fetchData();
    } finally {
      setBusy(null);
    }
  };

  const deleteProvider = async (id: string, name: string) => {
    if (!confirm(`Remover o provedor “${name}”? Os backups já enviados não são apagados.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/cloud-providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Provedor removido");
        fetchData();
      } else toast.error("Falha ao remover");
    } finally {
      setBusy(null);
    }
  };

  const uploadBackup = async (backupId: string) => {
    const providerId = uploadTarget[backupId] || providers[0]?.id;
    if (!providerId) {
      toast.error("Cadastre um provedor de nuvem primeiro");
      return;
    }
    setBusy(backupId);
    try {
      const res = await fetch(`/api/backups/${backupId}/upload-cloud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(d.message ?? "Enviado para a nuvem");
        fetchData();
      } else {
        toast.error(d.error ?? "Falha no envio");
      }
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async (backup: Backup) => {
    if (
      !confirm(
        `Restaurar “${backup.fileName}” no volume “${backup.source}”?\n\nOs arquivos atuais serão complementados/sobrescritos pelos do backup.`
      )
    )
      return;
    setBusy(backup.id);
    try {
      const res = await fetch(`/api/backups/${backup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const d = await res.json();
      if (res.ok) toast.success("Backup restaurado");
      else toast.error(d.error ?? "Falha ao restaurar");
    } finally {
      setBusy(null);
    }
  };

  const deleteBackup = async (id: string, fileName: string) => {
    if (!confirm(`Excluir o arquivo de backup “${fileName}”?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/backups/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Backup excluído");
        fetchData();
      } else toast.error("Falha ao excluir");
    } finally {
      setBusy(null);
    }
  };

  const deleteSchedule = async (id: string, name: string) => {
    if (!confirm(`Remover o agendamento “${name}”?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/backups/schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Agendamento removido");
        fetchData();
      } else toast.error("Falha ao remover");
    } finally {
      setBusy(null);
    }
  };

  const toggleSchedule = async (s: Schedule) => {
    setBusy(s.id);
    try {
      await fetch(`/api/backups/schedules/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      fetchData();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const sourceOptions = (type: string) => {
    if (type === "volume") return volumes.map((v) => v.name);
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Backups</h2>
          <p className="text-sm text-white/50 mt-1">
            Proteja seus dados e envie para a nuvem que você já usa
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "backups" && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNewBackup(true)}>
              Novo backup
            </Button>
          )}
          {tab === "schedules" && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNewSchedule(true)}>
              Novo agendamento
            </Button>
          )}
          {tab === "cloud" && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowPicker(true);
                setSelected(null);
              }}
            >
              Conectar serviço de nuvem
            </Button>
          )}
        </div>
      </div>

      {/* abas */}
      <div className="flex gap-1 border-b border-white/10">
        {[
          { key: "backups", label: `Backups (${backups.length})` },
          { key: "schedules", label: `Agendamentos (${schedules.length})` },
          { key: "cloud", label: `Nuvem (${providers.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t.key
                ? "border-blue-500 text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Backups ---------------- */}
      {tab === "backups" && (
        <div className="space-y-3">
          {backups.length === 0 && (
            <p className="text-sm text-white/40 py-8 text-center border border-dashed border-white/10 rounded-lg">
              Nenhum backup ainda. Clique em “Novo backup” para começar.
            </p>
          )}
          {backups.map((b) => (
            <div key={b.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{b.name}</p>
                    {statusBadge(b.status)}
                    {b.remotePath && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-500/15 text-violet-300 border-violet-500/30">
                        Na nuvem
                      </span>
                    )}
                    {b.existsOnDisk === false && b.status === "completed" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">
                        Arquivo ausente no disco
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1 font-mono truncate">
                    {b.type} · {b.source}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {b.fileName} · {formatBytes(b.fileSize)} · {formatDate(b.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {b.status === "completed" && (
                    <div className="flex gap-2">
                      <select
                        value={uploadTarget[b.id] ?? providers[0]?.id ?? ""}
                        onChange={(e) => setUploadTarget((m) => ({ ...m, [b.id]: e.target.value }))}
                        className="h-8 rounded-md bg-white/5 border border-white/10 px-2 text-xs text-white max-w-[150px]"
                      >
                        {providers.length === 0 && <option className="bg-[#141414]">Sem nuvem</option>}
                        {providers.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#141414]">
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-white/70 h-8"
                        disabled={busy === b.id || providers.length === 0}
                        onClick={() => uploadBackup(b.id)}
                      >
                        {busy === b.id ? "Enviando…" : "Enviar"}
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <a
                      href={`/api/backups/${b.id}/download`}
                      className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white"
                    >
                      Baixar
                    </a>
                    {b.status === "completed" && b.type === "volume" && (
                      <button
                        onClick={() => restoreBackup(b)}
                        disabled={busy === b.id}
                        className="text-xs px-3 py-1.5 rounded-md border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                      >
                        Restaurar
                      </button>
                    )}
                    <button
                      onClick={() => deleteBackup(b.id, b.fileName)}
                      disabled={busy === b.id}
                      className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Agendamentos ---------------- */}
      {tab === "schedules" && (
        <div className="space-y-3">
          {schedules.length === 0 && (
            <p className="text-sm text-white/40 py-8 text-center border border-dashed border-white/10 rounded-lg">
              Nenhum agendamento. Crie um para os backups rodarem sozinhos.
            </p>
          )}
          {schedules.map((s) => (
            <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{s.name}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        s.enabled
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-white/10 text-white/50 border-white/20"
                      }`}
                    >
                      {s.enabled ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1 font-mono truncate">
                    {s.type} · {s.source}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {describeCron(s.cron)} · retenção de {s.retention} cópias
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    Última execução: {formatDate(s.lastRun)} · Próxima: {formatDate(s.nextRun)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => toggleSchedule(s)}
                    disabled={busy === s.id}
                    className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white"
                  >
                    {s.enabled ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id, s.name)}
                    disabled={busy === s.id}
                    className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Nuvem ---------------- */}
      {tab === "cloud" && (
        <div className="space-y-4">
          {selected ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <ProviderForm
                provider={selected}
                saving={saving}
                onCancel={() => setSelected(null)}
                onSubmit={saveProvider}
                onTest={testProvider}
              />
            </div>
          ) : showPicker ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <ProviderPicker
                catalog={catalog}
                onPick={(p) => {
                  setSelected(p);
                  setShowPicker(false);
                }}
                onClose={() => setShowPicker(false)}
              />
            </div>
          ) : (
            <>
              {providers.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
                  <p className="text-sm text-white/60">Nenhum serviço de nuvem conectado</p>
                  <p className="text-xs text-white/40 mt-1">
                    Conecte Google Drive, OneDrive, Dropbox, Amazon S3, Backblaze, Nextcloud, SFTP e outros
                    para guardar seus backups fora do servidor.
                  </p>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
                    onClick={() => setShowPicker(true)}
                  >
                    Escolher serviço
                  </Button>
                </div>
              )}

              {providers.map((p) => {
                const def = catalog.find((c) => c.id === p.type);
                return (
                  <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <ProviderIcon
                          provider={def ?? { name: p.typeName, logo: "" }}
                          size={32}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white truncate">{p.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/10 text-white/60 border-white/20">
                              {p.typeName}
                            </span>
                            {!p.enabled && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">
                                Desativado
                              </span>
                            )}
                            {p.autoBackup && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                Automático ({p.autoFrequency})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 mt-1">
                            Pasta: {p.folder || "raiz"} · Último envio: {formatDate(p.lastSync)}
                          </p>
                          {p.lastError && (
                            <p className="text-xs text-red-400 mt-1 break-words">Último erro: {p.lastError}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => retestProvider(p.id)}
                          disabled={busy === p.id}
                          className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white"
                        >
                          {busy === p.id ? "Testando…" : "Testar"}
                        </button>
                        <button
                          onClick={() => deleteProvider(p.id, p.name)}
                          disabled={busy === p.id}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {providers.length > 0 && (
                <p className="text-xs text-white/30">
                  Os arquivos enviados continuam na sua conta de nuvem mesmo se você remover o provedor aqui.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- modais ---------------- */}
      {showNewBackup && (
        <Modal title="Novo backup" onClose={() => setShowNewBackup(false)}>
          <Field label="Nome">
            <Input value={backupName} onChange={(e) => setBackupName(e.target.value)} placeholder="Backup do banco" />
          </Field>
          <Field label="Tipo">
            <select
              value={backupType}
              onChange={(e) => {
                setBackupType(e.target.value);
                setBackupSource("");
              }}
              className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
            >
              <option value="volume" className="bg-[#141414]">Volume do Docker</option>
              <option value="file" className="bg-[#141414]">Pasta do servidor</option>
            </select>
          </Field>
          <Field
            label={backupType === "volume" ? "Volume" : "Caminho no servidor"}
            hint={
              backupType === "volume"
                ? "Nome do volume do Docker"
                : "Caminho absoluto, ex.: /var/www/meusite"
            }
          >
            {backupType === "volume" && volumes.length > 0 ? (
              <select
                value={backupSource}
                onChange={(e) => setBackupSource(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
              >
                <option value="" className="bg-[#141414]">Selecione…</option>
                {sourceOptions("volume").map((n) => (
                  <option key={n} value={n} className="bg-[#141414]">{n}</option>
                ))}
              </select>
            ) : (
              <Input
                value={backupSource}
                onChange={(e) => setBackupSource(e.target.value)}
                placeholder={backupType === "volume" ? "nome-do-volume" : "/var/www/meusite"}
              />
            )}
          </Field>
          <Actions onCancel={() => setShowNewBackup(false)} onConfirm={createBackup} saving={saving} confirmLabel="Fazer backup" />
        </Modal>
      )}

      {showNewSchedule && (
        <Modal title="Novo agendamento" onClose={() => setShowNewSchedule(false)}>
          <Field label="Nome">
            <Input value={schName} onChange={(e) => setSchName(e.target.value)} placeholder="Backup diário do banco" />
          </Field>
          <Field label="Tipo">
            <select
              value={schType}
              onChange={(e) => {
                setSchType(e.target.value);
                setSchSource("");
              }}
              className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
            >
              <option value="volume" className="bg-[#141414]">Volume do Docker</option>
              <option value="file" className="bg-[#141414]">Pasta do servidor</option>
            </select>
          </Field>
          <Field label={schType === "volume" ? "Volume" : "Caminho no servidor"}>
            {schType === "volume" && volumes.length > 0 ? (
              <select
                value={schSource}
                onChange={(e) => setSchSource(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
              >
                <option value="" className="bg-[#141414]">Selecione…</option>
                {volumes.map((v) => (
                  <option key={v.name} value={v.name} className="bg-[#141414]">{v.name}</option>
                ))}
              </select>
            ) : (
              <Input
                value={schSource}
                onChange={(e) => setSchSource(e.target.value)}
                placeholder={schType === "volume" ? "nome-do-volume" : "/var/www/meusite"}
              />
            )}
          </Field>
          <Field label="Quando executar" hint={`Formato cron de 5 campos · ${describeCron(schCron)}`}>
            <select
              value={schCron}
              onChange={(e) => setSchCron(e.target.value)}
              className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
            >
              <option value="0 2 * * *" className="bg-[#141414]">Todos os dias às 02:00</option>
              <option value="0 */6 * * *" className="bg-[#141414]">A cada 6 horas</option>
              <option value="0 */12 * * *" className="bg-[#141414]">A cada 12 horas</option>
              <option value="0 3 * * 0" className="bg-[#141414]">Domingos às 03:00</option>
              <option value="0 3 1 * *" className="bg-[#141414]">Todo dia 1º do mês às 03:00</option>
              <option value="*/30 * * * *" className="bg-[#141414]">A cada 30 minutos</option>
            </select>
          </Field>
          <Field label="Manter quantas cópias">
            <Input
              type="number"
              value={schRetention}
              onChange={(e) => setSchRetention(Number(e.target.value))}
              min={1}
            />
          </Field>
          {providers.length > 0 && (
            <Field label="Enviar também para" hint="Opcional: escolha um destino de nuvem">
              <select
                value={schCloud}
                onChange={(e) => setSchCloud(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
              >
                <option value="" className="bg-[#141414]">Nenhum (apenas local)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#141414]">{p.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Actions onCancel={() => setShowNewSchedule(false)} onConfirm={createSchedule} saving={saving} confirmLabel="Criar agendamento" />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------- componentes simples ------------------------- */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#141414] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-white/60 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function Actions({
  onCancel,
  onConfirm,
  saving,
  confirmLabel,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  confirmLabel: string;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={onConfirm} disabled={saving}>
        {saving ? "Executando…" : confirmLabel}
      </Button>
      <Button variant="ghost" className="text-white/50" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
    </div>
  );
}
