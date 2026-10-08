"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Globe, Lock, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Gerenciamento dos serviços de um projeto.
 *
 * Um projeto pode ter VÁRIOS serviços (app, banco, cache…), cada um com imagem,
 * portas, volumes, variáveis próprias e opção de publicar em um domínio.
 * O formulário é o mesmo para adicionar e editar, e há modelos prontos
 * (PostgreSQL, MySQL, Redis, MongoDB, WordPress…) para agilizar.
 */

export interface ServiceData {
  id: string;
  name: string;
  image: string;
  ports: string;
  volumes: string;
  command: string;
  domain: string;
  expose: boolean;
  note: string;
  envVars: string;
  status: string;
  containerId: string;
  position: number;
}

interface FieldState {
  name: string;
  image: string;
  ports: string;
  volumes: string;
  command: string;
  domain: string;
  expose: boolean;
  note: string;
  envVars: { key: string; value: string }[];
}

const EMPTY: FieldState = {
  name: "",
  image: "",
  ports: "",
  volumes: "",
  command: "",
  domain: "",
  expose: false,
  note: "",
  envVars: [{ key: "", value: "" }],
};

/** Modelos de uso comum — preenchem imagem/porta/volume/variáveis. */
const PRESETS: {
  label: string;
  image: string;
  ports: string;
  volumes: string;
  note: string;
  expose: boolean;
  envVars: { key: string; value: string }[];
}[] = [
  {
    label: "PostgreSQL 16",
    image: "postgres:16-alpine",
    ports: "",
    volumes: "pgdata:/var/lib/postgresql/data",
    note: "Banco interno (sem exposição externa)",
    expose: false,
    envVars: [
      { key: "POSTGRES_DB", value: "app" },
      { key: "POSTGRES_USER", value: "app" },
      { key: "POSTGRES_PASSWORD", value: "" },
    ],
  },
  {
    label: "MySQL 8",
    image: "mysql:8",
    ports: "",
    volumes: "mysqldata:/var/lib/mysql",
    note: "Banco interno (sem exposição externa)",
    expose: false,
    envVars: [
      { key: "MYSQL_DATABASE", value: "app" },
      { key: "MYSQL_USER", value: "app" },
      { key: "MYSQL_PASSWORD", value: "" },
      { key: "MYSQL_ROOT_PASSWORD", value: "" },
    ],
  },
  {
    label: "Redis 7",
    image: "redis:7-alpine",
    ports: "",
    volumes: "redisdata:/data",
    note: "Cache interno (sem exposição externa)",
    expose: false,
    envVars: [],
  },
  {
    label: "MongoDB 7",
    image: "mongo:7",
    ports: "",
    volumes: "mongodata:/data/db",
    note: "Banco interno (sem exposição externa)",
    expose: false,
    envVars: [{ key: "MONGO_INITDB_ROOT_USERNAME", value: "admin" }, { key: "MONGO_INITDB_ROOT_PASSWORD", value: "" }],
  },
  {
    label: "Nginx (site estático)",
    image: "nginx:alpine",
    ports: "8080:80",
    volumes: "sitestatic:/usr/share/nginx/html",
    note: "Servidor web publicado em domínio",
    expose: true,
    envVars: [],
  },
  {
    label: "Node.js (app)",
    image: "node:20-alpine",
    ports: "3000:3000",
    volumes: "appdata:/app",
    note: "Aplicação Node — ajuste o comando",
    expose: true,
    envVars: [{ key: "NODE_ENV", value: "production" }],
  },
  {
    label: "Python (app)",
    image: "python:3.12-slim",
    ports: "8000:8000",
    volumes: "appdata:/app",
    note: "Aplicação Python — ajuste o comando",
    expose: true,
    envVars: [],
  },
  {
    label: "WordPress + MySQL",
    image: "wordpress:latest",
    ports: "8080:80",
    volumes: "wpdata:/var/www/html",
    note: "Adicione também um serviço MySQL neste projeto",
    expose: true,
    envVars: [
      { key: "WORDPRESS_DB_HOST", value: "mysql:3306" },
      { key: "WORDPRESS_DB_NAME", value: "wordpress" },
      { key: "WORDPRESS_DB_USER", value: "wordpress" },
      { key: "WORDPRESS_DB_PASSWORD", value: "" },
    ],
  },
];

function toFieldState(s: ServiceData): FieldState {
  let envVars: { key: string; value: string }[] = [];
  try {
    const parsed = JSON.parse(s.envVars || "[]");
    if (Array.isArray(parsed)) envVars = parsed.map((e) => ({ key: String(e.key ?? ""), value: String(e.value ?? "") }));
  } catch {
    envVars = [];
  }
  return {
    name: s.name,
    image: s.image,
    ports: s.ports,
    volumes: s.volumes,
    command: s.command,
    domain: s.domain,
    expose: s.expose,
    note: s.note,
    envVars: envVars.length ? envVars : [{ key: "", value: "" }],
  };
}

function cleanEnv(list: { key: string; value: string }[]) {
  return list.filter((e) => e.key.trim());
}

function ServiceForm({
  initial,
  projectDomain,
  saving,
  onCancel,
  onSave,
}: {
  initial: FieldState;
  projectDomain: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: FieldState) => void;
}) {
  const [f, setF] = useState<FieldState>(initial);
  const set = <K extends keyof FieldState>(k: K, v: FieldState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setF({
      name: p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30),
      image: p.image,
      ports: p.ports,
      volumes: p.volumes,
      command: "",
      domain: "",
      expose: p.expose && Boolean(projectDomain),
      note: p.note,
      envVars: p.envVars.length ? p.envVars : [{ key: "", value: "" }],
    });
  };

  const valid = f.image.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-white/50 mb-2">Começar de um modelo (opcional)</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/60 mb-1 block">Nome do serviço</label>
          <Input
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="app (vazio usa o nome da imagem)"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">
            Imagem Docker <span className="text-red-400">*</span>
          </label>
          <Input value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="nginx:alpine" />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Portas (host:container)</label>
          <Input value={f.ports} onChange={(e) => set("ports", e.target.value)} placeholder="8080:80" />
          <p className="text-[11px] text-white/35 mt-1">
            Deixe vazio para banco/cache acessado só pela rede interna. Separe várias por vírgula.
          </p>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Volumes (nome:/destino)</label>
          <Input
            value={f.volumes}
            onChange={(e) => set("volumes", e.target.value)}
            placeholder="dados:/var/lib/postgresql/data"
          />
          <p className="text-[11px] text-white/35 mt-1">Separe vários por vírgula.</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/60 mb-1 block">Comando (opcional)</label>
        <Input value={f.command} onChange={(e) => set("command", e.target.value)} placeholder='ex.: node server.js' />
      </div>

      <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white">Publicar em domínio (HTTPS automático)</p>
            <p className="text-[11px] text-white/40">
              {projectDomain
                ? `Domínio do projeto: ${projectDomain}`
                : "Dica: defina o domínio na aba Configurações do projeto."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => set("expose", !f.expose)}
            className={`w-11 h-6 rounded-full transition-colors shrink-0 ${f.expose ? "bg-emerald-500" : "bg-white/20"}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${f.expose ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
        {f.expose && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">
              Domínio próprio deste serviço (opcional)
            </label>
            <Input
              value={f.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder={projectDomain || "app.seudominio.com"}
            />
            <p className="text-[11px] text-white/35 mt-1">
              Use isto quando o projeto tem vários apps e cada um precisa de uma URL diferente.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/60">Variáveis deste serviço</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-blue-400 h-7"
            onClick={() => set("envVars", [...f.envVars, { key: "", value: "" }])}
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {f.envVars.map((ev, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={ev.key}
                onChange={(e) => {
                  const next = [...f.envVars];
                  next[i] = { ...next[i], key: e.target.value };
                  set("envVars", next);
                }}
                placeholder="CHAVE"
                className="font-mono text-xs"
              />
              <Input
                value={ev.value}
                onChange={(e) => {
                  const next = [...f.envVars];
                  next[i] = { ...next[i], value: e.target.value };
                  set("envVars", next);
                }}
                placeholder="valor"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-400 h-9 px-2"
                onClick={() => set("envVars", f.envVars.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!valid || saving}
          onClick={() => onSave({ ...f, envVars: cleanEnv(f.envVars) })}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Salvar serviço
        </Button>
        <Button variant="ghost" className="text-white/50" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
      {!valid && <p className="text-[11px] text-amber-400">Informe a imagem Docker (ex.: nginx:alpine).</p>}
    </div>
  );
}

export function ServicesPanel({
  projectId,
  projectDomain,
  services,
  onChanged,
}: {
  projectId: string;
  projectDomain: string;
  services: ServiceData[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const addService = async (data: FieldState) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || undefined,
          image: data.image,
          ports: data.ports,
          volumes: data.volumes,
          command: data.command,
          domain: data.domain,
          expose: data.expose,
          note: data.note,
          envVars: data.envVars,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Serviço "${d.name}" adicionado`);
        setShowAdd(false);
        onChanged();
      } else {
        toast.error(d.error ?? "Erro ao adicionar serviço");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateService = async (id: string, data: FieldState) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || undefined,
          image: data.image,
          ports: data.ports,
          volumes: data.volumes,
          command: data.command,
          domain: data.domain,
          expose: data.expose,
          note: data.note,
          envVars: data.envVars,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("Serviço atualizado");
        setEditing(null);
        onChanged();
      } else {
        toast.error(d.error ?? "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  };

  const removeService = async (id: string, name: string, hasContainer: boolean) => {
    const msg = hasContainer
      ? `Remover o serviço "${name}"? O container dele será parado e apagado.`
      : `Remover o serviço "${name}"?`;
    if (!confirm(msg)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/projects/${projectId}/services/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Serviço removido");
        onChanged();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Erro ao remover");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/70">
            {services.length} serviço{services.length === 1 ? "" : "s"} neste projeto
          </p>
          <p className="text-[11px] text-white/40">
            Um projeto pode rodar vários serviços juntos (app + banco + cache), como no Easypanel.
          </p>
        </div>
        {!showAdd && (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar serviço
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="text-sm font-medium text-white mb-3">Novo serviço</p>
          <ServiceForm
            initial={EMPTY}
            projectDomain={projectDomain}
            saving={saving}
            onCancel={() => setShowAdd(false)}
            onSave={addService}
          />
        </div>
      )}

      {services.length === 0 && !showAdd && (
        <div className="rounded-lg border border-dashed border-white/15 py-10 text-center">
          <p className="text-sm text-white/60">Este projeto ainda não tem serviços</p>
          <p className="text-xs text-white/40 mt-1 max-w-md mx-auto">
            Adicione o primeiro serviço: escolha uma imagem Docker (ex.: <code className="text-blue-400">nginx:alpine</code>)
            e, se ele for um site/aplicação, informe uma porta e publique em um domínio.
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white mt-4" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro serviço
          </Button>
        </div>
      )}

      {services.map((s) =>
        editing === s.id ? (
          <div key={s.id} className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="text-sm font-medium text-white mb-3">Editar {s.name}</p>
            <ServiceForm
              initial={toFieldState(s)}
              projectDomain={projectDomain}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(data) => updateService(s.id, data)}
            />
          </div>
        ) : (
          <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${s.status === "running" ? "bg-green-400" : "bg-white/20"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/10 text-white/60 border-white/20 font-mono">
                      {s.image}
                    </span>
                    {s.expose ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {s.domain || projectDomain || "publicado"}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/5 text-white/40 border-white/10 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> interno
                      </span>
                    )}
                    {s.status === "running" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-500/15 text-green-400 border-green-500/30">
                        Rodando
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1 font-mono">
                    {s.ports ? `portas ${s.ports}` : "sem porta externa"}
                    {s.volumes ? ` · volumes ${s.volumes}` : ""}
                  </p>
                  {s.note && <p className="text-xs text-white/35 mt-1">{s.note}</p>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="text-xs px-2 py-1.5 rounded-md border border-white/10 text-white/50 hover:text-white"
                  title="Detalhes"
                >
                  {expanded === s.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setEditing(s.id)}
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white"
                >
                  Editar
                </button>
                <button
                  onClick={() => removeService(s.id, s.name, Boolean(s.containerId))}
                  disabled={busy === s.id}
                  className="text-xs px-2 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {expanded === s.id && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs">
                <p className="text-white/50">
                  Comando: <span className="text-white/70 font-mono">{s.command || "(padrão da imagem)"}</span>
                </p>
                <p className="text-white/50">
                  Container:{" "}
                  {s.containerId ? (
                    <a href={`/containers/${s.containerId}`} className="text-blue-400 hover:underline font-mono">
                      {s.containerId.slice(0, 12)}
                    </a>
                  ) : (
                    <span className="text-white/35">não criado (implante o projeto)</span>
                  )}
                </p>
                {(() => {
                  let list: { key: string; value: string }[] = [];
                  try {
                    list = JSON.parse(s.envVars || "[]");
                  } catch {
                    list = [];
                  }
                  if (!list.length) return <p className="text-white/35">Sem variáveis próprias</p>;
                  return (
                    <div>
                      <p className="text-white/50 mb-1">Variáveis deste serviço:</p>
                      <div className="font-mono text-[11px] space-y-0.5">
                        {list.map((e, i) => (
                          <p key={i} className="text-white/60">
                            {e.key}=<span className="text-white/35">{"•".repeat(Math.min(8, Math.max(0, e.value.length)))}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
