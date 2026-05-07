"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Scaling,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Gauge,
  Cpu,
  MemoryStick,
  ArrowUpDown,
  Power,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ScalingRuleData {
  id: string;
  name: string;
  projectId: string;
  metric: string;
  threshold: number;
  minReplicas: number;
  maxReplicas: number;
  cooldown: number;
  enabled: boolean;
  currentReplicas: number;
  lastScaled: string | null;
  createdAt: string;
}

interface ProjectData {
  id: string;
  name: string;
}

export default function ScalingPage() {
  const [rules, setRules] = useState<ScalingRuleData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [metric, setMetric] = useState("cpu");
  const [threshold, setThreshold] = useState(80);
  const [minReplicas, setMinReplicas] = useState(1);
  const [maxReplicas, setMaxReplicas] = useState(5);
  const [cooldown, setCooldown] = useState(60);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, projectsRes] = await Promise.all([
        fetch("/api/scaling"),
        fetch("/api/projects"),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createRule = async () => {
    if (!name || !projectId) { toast.error("Nome e projeto são obrigatórios"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/scaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId, metric, threshold, minReplicas, maxReplicas, cooldown }),
      });
      if (res.ok) {
        toast.success("Regra criada!");
        setShowForm(false); setName("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setCreating(false); }
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    await fetch(`/api/scaling/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    toast.success(enabled ? "Regra desativada" : "Regra ativada");
    fetchData();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    await fetch(`/api/scaling/${id}`, { method: "DELETE" });
    toast.success("Regra removida");
    fetchData();
  };

  const getProjectName = (pid: string) => projects.find(p => p.id === pid)?.name || pid;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Auto Scaling</h2>
          <p className="text-sm text-white/50 mt-1">Regras de escalonamento automático por projeto</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Nova Regra de Auto Scaling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scale Web API"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Projeto</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="">Selecionar...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Métrica</label>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="cpu">CPU</option>
                  <option value="memory">Memória</option>
                  <option value="requests">Requisições/s</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Threshold (%)</label>
                <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Min Replicas</label>
                <Input type="number" value={minReplicas} onChange={(e) => setMinReplicas(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Max Replicas</label>
                <Input type="number" value={maxReplicas} onChange={(e) => setMaxReplicas(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Cooldown (s)</label>
                <Input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createRule} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />} Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Scaling className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhuma regra de scaling criada</p>
            <p className="text-xs text-white/25 mt-1">Crie regras para escalar containers automaticamente</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar Regra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id} className={`bg-[#111] border-white/10 ${r.enabled ? "border-blue-500/20" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${r.enabled ? "bg-blue-500/10" : "bg-white/5"}`}>
                      {r.metric === "cpu" ? <Cpu className="h-4 w-4 text-blue-400" /> :
                       r.metric === "memory" ? <MemoryStick className="h-4 w-4 text-green-400" /> :
                       <Gauge className="h-4 w-4 text-yellow-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{r.name}</span>
                        <Badge className={`border-0 text-[10px] ${r.enabled ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                          {r.enabled ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                        <span>Projeto: {getProjectName(r.projectId)}</span>
                        <span className="flex items-center gap-0.5"><Gauge className="h-2.5 w-2.5" /> {r.metric.toUpperCase()} &gt; {r.threshold}%</span>
                        <span className="flex items-center gap-0.5"><ArrowUpDown className="h-2.5 w-2.5" /> {r.minReplicas}-{r.maxReplicas} replicas</span>
                        <span>Cooldown: {r.cooldown}s</span>
                        <span className="font-medium text-blue-400">{r.currentReplicas} ativa(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => toggleRule(r.id, r.enabled)}>
                      {r.enabled ? <Power className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deleteRule(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
