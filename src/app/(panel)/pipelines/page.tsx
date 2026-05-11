"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Hammer,
  FlaskConical,
  Rocket,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

interface StageResult {
  name: string;
  status: string;
  duration: number;
  output: string;
}

interface PipelineRun {
  id: string;
  status: string;
  duration: number;
  logs: string;
  stageResults: string;
  createdAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  type: string;
  command: string;
  order: number;
}

interface PipelineData {
  id: string;
  name: string;
  projectId: string;
  trigger: string;
  status: string;
  lastRun: string | null;
  stages: PipelineStage[];
  runs: PipelineRun[];
  createdAt: string;
}

interface ProjectData {
  id: string;
  name: string;
}

function stageIcon(type: string) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "build": return <Hammer className={cls} />;
    case "test": return <FlaskConical className={cls} />;
    case "deploy": return <Rocket className={cls} />;
    default: return <Terminal className={cls} />;
  }
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [stages, setStages] = useState<{ name: string; type: string; command: string }[]>([
    { name: "Build", type: "build", command: "" },
    { name: "Test", type: "test", command: "" },
    { name: "Deploy", type: "deploy", command: "" },
  ]);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pipRes, projRes] = await Promise.all([
        fetch("/api/pipelines"),
        fetch("/api/projects"),
      ]);
      if (pipRes.ok) setPipelines(await pipRes.json());
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createPipeline = async () => {
    if (!name || !projectId) { toast.error("Nome e projeto são obrigatórios"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId, trigger, stages: stages.filter(s => s.name) }),
      });
      if (res.ok) {
        toast.success("Pipeline criado!");
        setShowForm(false); setName("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setCreating(false); }
  };

  const runPipeline = async (id: string) => {
    setRunning(id);
    try {
      const res = await fetch(`/api/pipelines/${id}/run`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Pipeline ${data.status === "success" ? "concluído" : "falhou"} (${data.duration}ms)`);
        fetchData();
      }
    } catch { toast.error("Erro ao executar"); }
    finally { setRunning(null); }
  };

  const deletePipeline = async (id: string) => {
    if (!confirm("Remover esta pipeline?")) return;
    await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
    toast.success("Pipeline removido");
    fetchData();
  };

  const addStage = () => setStages([...stages, { name: "", type: "build", command: "" }]);
  const removeStage = (i: number) => setStages(stages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: string, val: string) => {
    const updated = [...stages];
    (updated[i] as Record<string, string>)[field] = val;
    setStages(updated);
  };

  const getProjectName = (pid: string) => projects.find(p => p.id === pid)?.name || pid;

  const statusColor = (s: string) => {
    switch (s) {
      case "success": return "bg-green-500/10 text-green-400";
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
          <h2 className="text-2xl font-bold text-white">CI/CD Pipelines</h2>
          <p className="text-sm text-white/50 mt-1">Pipelines visuais de build, teste e deploy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Pipeline
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Nova Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deploy Production"
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
                <label className="text-xs text-white/50 mb-1 block">Trigger</label>
                <select value={trigger} onChange={(e) => setTrigger(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="manual">Manual</option>
                  <option value="push">Git Push</option>
                  <option value="schedule">Agendado</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50">Estágios</label>
                <Button variant="ghost" size="sm" className="text-blue-400 h-7 text-xs" onClick={addStage}>
                  <Plus className="h-3 w-3 mr-1" /> Estágio
                </Button>
              </div>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-white/20 text-xs w-6 justify-center">{i + 1}</div>
                    <Input value={s.name} onChange={(e) => updateStage(i, "name", e.target.value)} placeholder="Nome"
                      className="bg-white/5 border-white/10 text-white h-8 text-xs flex-1" />
                    <select value={s.type} onChange={(e) => updateStage(i, "type", e.target.value)}
                      className="h-8 rounded-md bg-white/5 border border-white/10 text-white text-xs px-2 w-28">
                      <option value="build">Build</option>
                      <option value="test">Test</option>
                      <option value="deploy">Deploy</option>
                      <option value="custom">Custom</option>
                    </select>
                    <Input value={s.command} onChange={(e) => updateStage(i, "command", e.target.value)} placeholder="Comando (opcional)"
                      className="bg-white/5 border-white/10 text-white h-8 text-xs flex-1" />
                    <Button variant="ghost" size="sm" className="h-8 text-red-400/50 hover:text-red-400 px-2" onClick={() => removeStage(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={createPipeline} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <GitBranch className="h-3.5 w-3.5 mr-1" />} Criar Pipeline
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pipelines.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <GitBranch className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhuma pipeline criada</p>
            <p className="text-xs text-white/25 mt-1">Crie pipelines para automatizar build, teste e deploy</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <Card key={p.id} className="bg-[#111] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-blue-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <Badge className={`border-0 text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge>
                        <Badge className="border-0 text-[10px] bg-white/5 text-white/30">{p.trigger}</Badge>
                      </div>
                      <span className="text-[10px] text-white/30">Projeto: {getProjectName(p.projectId)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-400/50 hover:text-green-400"
                      onClick={() => runPipeline(p.id)} disabled={running === p.id}>
                      {running === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                      {expanded === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deletePipeline(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Pipeline stages visual */}
                <div className="flex items-center gap-1 mb-3">
                  {p.stages.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded text-[10px] text-white/50">
                        {stageIcon(s.type)}
                        <span>{s.name}</span>
                      </div>
                      {i < p.stages.length - 1 && <span className="text-white/10">→</span>}
                    </div>
                  ))}
                </div>

                {expanded === p.id && p.runs.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-white/5">
                    <h4 className="text-xs text-white/40 font-medium">Últimas execuções</h4>
                    {p.runs.map((run) => {
                      let stageResults: StageResult[] = [];
                      try { stageResults = JSON.parse(run.stageResults); } catch { /* silent */ }
                      return (
                        <div key={run.id} className="bg-white/5 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {run.status === "success" ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                              <Badge className={`border-0 text-[10px] ${statusColor(run.status)}`}>{run.status}</Badge>
                              <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {run.duration}ms</span>
                            </div>
                            <span className="text-[10px] text-white/20">{new Date(run.createdAt).toLocaleString("pt-BR")}</span>
                          </div>
                          {stageResults.length > 0 && (
                            <div className="flex gap-1">
                              {stageResults.map((sr, i) => (
                                <div key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${sr.status === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                  {sr.status === "success" ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                                  {sr.name} ({sr.duration}ms)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {p.lastRun && (
                  <p className="text-[10px] text-white/20 mt-1">Última execução: {new Date(p.lastRun).toLocaleString("pt-BR")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
