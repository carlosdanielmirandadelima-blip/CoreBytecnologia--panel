"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

/**
 * Catálogo de provedores de nuvem usado na interface.
 * Mantido enxuto (só o necessário para desenhar o formulário) para não
 * carregar a lógica de servidor no cliente.
 */

export interface StorageField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "select" | "textarea" | "switch";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  default?: string;
}

export interface ProviderDef {
  id: string;
  name: string;
  group: "s3" | "oauth" | "key" | "file";
  logo: string;
  logoColor?: string;
  authType: string;
  fields: StorageField[];
  help?: string;
  note?: string;
}

export const GROUPS: { key: ProviderDef["group"]; label: string; description: string }[] = [
  { key: "s3", label: "Armazenamento S3", description: "Amazon S3, Cloudflare R2, Backblaze, Wasabi, MinIO, DigitalOcean, Storj…" },
  { key: "oauth", label: "Contas Google, Microsoft, Dropbox e Box", description: "Conecte a conta que você já usa" },
  { key: "key", label: "Chave ou token", description: "pCloud, MEGA e TeraBox" },
  { key: "file", label: "Servidor de arquivos", description: "WebDAV, Nextcloud, FTP/FTPS e SFTP" },
];

/** Ícone do serviço: usa o logo oficial; cai para uma inicial se não houver. */
export function ProviderIcon({ provider, size = 32 }: { provider: { logo?: string; logoColor?: string; name: string }; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = provider.logo
    ? `https://cdn.simpleicons.org/${provider.logo}${provider.logoColor ? `/${provider.logoColor}` : ""}`
    : "";

  if (!url || failed) {
    return (
      <span
        className="flex items-center justify-center rounded-lg bg-white/10 text-white/70 font-semibold"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {provider.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={provider.name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded object-contain"
      onError={() => setFailed(true)}
    />
  );
}

interface ProviderFormProps {
  provider: ProviderDef;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    folder: string;
    config: Record<string, string>;
    autoBackup: boolean;
    autoFrequency: string;
  }) => Promise<void>;
  onTest: (config: Record<string, string>, folder: string) => Promise<void>;
}

/**
 * Formulário de conexão, gerado a partir dos campos que o próprio serviço
 * declara. É isso que permite ter Google Drive, S3, WebDAV, SFTP etc. com
 * campos corretos em vez de um único "token" genérico.
 */
export function ProviderForm({ provider, saving, onCancel, onSubmit, onTest }: ProviderFormProps) {
  const [name, setName] = useState(provider.name);
  const [folder, setFolder] = useState("/CoreByte-Backups");
  const [autoBackup, setAutoBackup] = useState(false);
  const [autoFrequency, setAutoFrequency] = useState("daily");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of provider.fields) initial[f.key] = f.default ?? "";
    return initial;
  });
  const [testing, setTesting] = useState(false);

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest(values, folder);
    } finally {
      setTesting(false);
    }
  };

  const missing = provider.fields
    .filter((f) => f.required && !String(values[f.key] || "").trim())
    .map((f) => f.label);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <ProviderIcon provider={provider} size={40} />
        <div>
          <h3 className="text-base font-semibold text-white">{provider.name}</h3>
          <p className="text-xs text-white/50">
            {provider.authType === "oauth"
              ? "Conecte a conta e o CoreByte renova o acesso sozinho"
              : provider.authType === "service_account"
              ? "Autenticação por service account (ideal para servidor)"
              : "Credenciais do serviço"}
          </p>
        </div>
      </div>

      {provider.help && (
        <p className="text-xs text-blue-300/80 bg-blue-500/10 border border-blue-500/20 rounded-md p-2.5">
          {provider.help}
        </p>
      )}
      {provider.note && (
        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5">
          {provider.note}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/60 mb-1 block">Nome no painel</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={provider.name} />
        </div>

        {provider.fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-white/60 mb-1 block">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === "select" ? (
              <select
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
              >
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#141414]">
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "switch" ? (
              <button
                type="button"
                onClick={() => set(field.key, values[field.key] === "false" ? "true" : "false")}
                className={`w-full h-9 rounded-md border px-3 text-sm text-left ${
                  values[field.key] !== "false"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                    : "bg-white/5 border-white/10 text-white/50"
                }`}
              >
                {values[field.key] !== "false" ? "Ativado" : "Desativado"}
              </button>
            ) : field.type === "textarea" ? (
              <textarea
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white font-mono"
              />
            ) : (
              <Input
                type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}

            {field.help && <p className="text-[11px] text-white/40 mt-1">{field.help}</p>}
          </div>
        ))}

        <div>
          <label className="text-xs text-white/60 mb-1 block">Pasta remota</label>
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="/CoreByte-Backups" />
        </div>

        <div className="flex items-center justify-between rounded-md bg-white/5 border border-white/10 p-3">
          <div>
            <p className="text-sm text-white">Enviar backups automaticamente</p>
            <p className="text-[11px] text-white/40">Todo backup agendado também vai para este destino</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoBackup((v) => !v)}
            className={`w-11 h-6 rounded-full transition-colors ${autoBackup ? "bg-emerald-500" : "bg-white/20"}`}
          >
            <span
              className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                autoBackup ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {autoBackup && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Frequência do envio automático</label>
            <select
              value={autoFrequency}
              onChange={(e) => setAutoFrequency(e.target.value)}
              className="w-full h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
            >
              <option value="daily" className="bg-[#141414]">Diário</option>
              <option value="weekly" className="bg-[#141414]">Semanal</option>
              <option value="monthly" className="bg-[#141414]">Mensal</option>
            </select>
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-amber-400">Preencha: {missing.join(", ")}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="border-white/10 text-white/70"
          onClick={handleTest}
          disabled={testing || saving || missing.length > 0}
        >
          {testing ? "Testando…" : "Testar conexão"}
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={saving || missing.length > 0 || !name.trim()}
          onClick={() => onSubmit({ name, folder, config: values, autoBackup, autoFrequency })}
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="ghost" className="text-white/50" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Seletor de serviço: agrupa o catálogo por família para o usuário achar
 * "Google Drive" ou "Backblaze B2" direto, sem saber o que é S3.
 */
export function ProviderPicker({
  catalog,
  onPick,
  onClose,
}: {
  catalog: ProviderDef[];
  onPick: (p: ProviderDef) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? catalog.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.fields.some((f) => f.label.toLowerCase().includes(term))
        )
      : catalog;
    return GROUPS.map((g) => ({ ...g, items: filtered.filter((p) => p.group === g.key) })).filter(
      (g) => g.items.length > 0
    );
  }, [catalog, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Escolha o serviço de nuvem</h3>
          <p className="text-xs text-white/50">{catalog.length} serviços disponíveis</p>
        </div>
        <Button variant="ghost" size="sm" className="text-white/50" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <Input placeholder="Buscar serviço… (ex.: Google Drive, S3, SFTP)" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-medium text-white/70">{group.label}</p>
            <p className="text-[11px] text-white/40 mb-2">{group.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 p-3 text-left transition-colors"
                >
                  <ProviderIcon provider={p} size={28} />
                  <span className="text-sm text-white">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-white/40 text-center py-6">Nenhum serviço encontrado para “{search}”.</p>
        )}
      </div>
    </div>
  );
}

export { Card };
