"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Server,
} from "lucide-react";
import { toast } from "sonner";

interface ContainerInfo {
  Id: string;
  Names: string[];
  State: string;
  Image: string;
}

interface NodeInfo {
  id: string;
  name: string;
  endpoint: string;
}

interface MigrationData {
  id: string;
  containerId: string;
  containerName: string;
  sourceServer: string;
  targetServer: string;
  status: string;
  progress: number;
  logs: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function MigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationData[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [servers, setServers] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [containerId, setContainerId] = useState("");
  const [targetServer, setTargetServer] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [migRes, cntRes, srvRes] = await Promise.all([
        fetch("/api/migrations"),
        fetch("/api/containers"),
        fetch("/api/nodes"),
      ]);
      if (migRes.ok) setMigrations(await migRes.json());
      if (cntRes.ok) {
        const data = await cntRes.json();
        setContainers(Array.isArray(data) ? data : []);
      }
      if (srvRes.ok) {
        const data = await srvRes.json();
        setServers(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startMigration = async () => {
    if (!containerId || !targetServer) { toast.error("Container e servidor destino são obrigatórios"); return; }
    setMigrating(true);
    try {
      const container = containers.find(c => c.Id === containerId);
      const res = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerId,
          containerName: container?.Names?.[0]?.replace("/", "") || containerId.substring(0, 12),
          targetServer,
        }),
      });
      if (res.ok) {
        toast.success("Migração concluída!");
        setShowForm(false); setContainerId(""); setTargetServer("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setMigrating(false); }
  };

  const deleteMigration = async (id: string) => {
    if (!confirm("Remover registro?")) return;
    await fetch(`/api/migrations/${id}`, { method: "DELETE" });
    toast.success("Removido");
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500/10 text-green-400";
      case "failed": return "bg-red-500/10 text-red-400";
      case "running": return "bg-blue-500/10 text-blue-400";
      default: return "bg-white/5 text-white/30";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Migration Wizard</h2>
          <p className="text-sm text-white/50 mt-1">Migre containers entre servidores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Migração
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Nova Migração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Container</label>
                <select value={containerId} onChange={(e) => setContainerId(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="">Selecionar...</option>
                  {containers.map(c => (
                    <option key={c.Id} value={c.Id}>{c.Names?.[0]?.replace("/", "") || c.Id.substring(0, 12)} ({c.Image})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Servidor Destino</label>
                {servers.length > 0 ? (
                  <select value={targetServer} onChange={(e) => setTargetServer(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                    <option value="">Selecionar...</option>
                    {servers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <Input value={targetServer} onChange={(e) => setTargetServer(e.target.value)} placeholder="IP ou hostname do servidor"
                    className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={startMigration} disabled={migrating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />} Iniciar Migração
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {migrations.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhuma migração realizada</p>
            <p className="text-xs text-white/25 mt-1">Migre containers entre servidores de forma simples</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Migrar Container
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {migrations.map((m) => (
            <Card key={m.id} className="bg-[#111] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${m.status === "completed" ? "bg-green-500/10" : m.status === "failed" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                      {m.status === "completed" ? <CheckCircle className="h-4 w-4 text-green-400" /> :
                       m.status === "failed" ? <XCircle className="h-4 w-4 text-red-400" /> :
                       <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{m.containerName}</span>
                        <Badge className={`border-0 text-[10px] ${statusColor(m.status)}`}>{m.status}</Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/30">
                        <Server className="h-2.5 w-2.5" /> {m.sourceServer} → {m.targetServer}
                        {m.completedAt && <span className="ml-2">{new Date(m.completedAt).toLocaleString("pt-BR")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                      {expanded === m.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deleteMigration(m.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m.status === "completed" ? "bg-green-500" : m.status === "failed" ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${m.progress}%` }} />
                </div>
                {expanded === m.id && m.logs && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <pre className="text-[10px] text-white/40 bg-black/30 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">{m.logs}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
