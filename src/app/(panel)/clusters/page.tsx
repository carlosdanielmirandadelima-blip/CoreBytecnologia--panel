"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Server,
  Box,
  Cpu,
  MemoryStick,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface ClusterData {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  status: string;
  version: string;
  nodes: number;
  pods: number;
  services: number;
  cpuPercent: number;
  memoryPercent: number;
  lastCheck: string | null;
  createdAt: string;
}

export default function ClustersPage() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/clusters");
      if (res.ok) setClusters(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createCluster = async () => {
    if (!name) { toast.error("Nome é obrigatório"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, endpoint, token }),
      });
      if (res.ok) {
        toast.success("Cluster adicionado!");
        setShowForm(false); setName(""); setEndpoint(""); setToken("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setCreating(false); }
  };

  const deleteCluster = async (id: string) => {
    if (!confirm("Remover este cluster?")) return;
    await fetch(`/api/clusters/${id}`, { method: "DELETE" });
    toast.success("Cluster removido");
    fetchData();
  };

  const checkCluster = async (id: string) => {
    setChecking(id);
    try {
      const res = await fetch(`/api/clusters/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (data.status === "connected") toast.success(`Conectado! ${data.nodes} nodes, ${data.pods} pods`);
      else toast.error(data.message || "Não conectado");
      fetchData();
    } catch { toast.error("Erro"); }
    finally { setChecking(null); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "connected": return "bg-green-500/10 text-green-400";
      case "error": return "bg-red-500/10 text-red-400";
      default: return "bg-white/5 text-white/40";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Clusters K3s</h2>
          <p className="text-sm text-white/50 mt-1">Gerencie clusters Kubernetes leves</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Cluster
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Cluster K3s</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Produção"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Endpoint da API</label>
                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://k3s.example.com:6443"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Token</label>
                <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createCluster} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />} Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {clusters.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Network className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum cluster adicionado</p>
            <p className="text-xs text-white/25 mt-1">Adicione um cluster K3s para gerenciar workloads Kubernetes</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Cluster
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clusters.map((c) => (
            <Card key={c.id} className="bg-[#111] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-medium text-white">{c.name}</h3>
                    <Badge className={`border-0 text-[10px] ${statusColor(c.status)}`}>{c.status}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => checkCluster(c.id)} disabled={checking === c.id}>
                      {checking === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deleteCluster(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-white/5 rounded p-2 text-center">
                    <Server className="h-3.5 w-3.5 text-white/30 mx-auto mb-1" />
                    <span className="text-lg font-bold text-white">{c.nodes}</span>
                    <p className="text-[10px] text-white/30">Nodes</p>
                  </div>
                  <div className="bg-white/5 rounded p-2 text-center">
                    <Box className="h-3.5 w-3.5 text-white/30 mx-auto mb-1" />
                    <span className="text-lg font-bold text-white">{c.pods}</span>
                    <p className="text-[10px] text-white/30">Pods</p>
                  </div>
                  <div className="bg-white/5 rounded p-2 text-center">
                    <Activity className="h-3.5 w-3.5 text-white/30 mx-auto mb-1" />
                    <span className="text-lg font-bold text-white">{c.services}</span>
                    <p className="text-[10px] text-white/30">Services</p>
                  </div>
                </div>

                {c.status === "connected" && (
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-white/30 mb-1">
                        <span className="flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> CPU</span>
                        <span>{c.cpuPercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.cpuPercent > 90 ? "bg-red-500" : c.cpuPercent > 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(c.cpuPercent, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-white/30 mb-1">
                        <span className="flex items-center gap-1"><MemoryStick className="h-2.5 w-2.5" /> Memória</span>
                        <span>{c.memoryPercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.memoryPercent > 90 ? "bg-red-500" : c.memoryPercent > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(c.memoryPercent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-white/20 mt-2">
                  {c.endpoint || "Endpoint não configurado"}
                  {c.lastCheck && ` • Último check: ${new Date(c.lastCheck).toLocaleTimeString("pt-BR")}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
