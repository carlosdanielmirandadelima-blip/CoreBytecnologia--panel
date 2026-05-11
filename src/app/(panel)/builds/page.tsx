"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Hammer,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

interface BuildJobData {
  id: string;
  name: string;
  source: string;
  dockerfile: string;
  context: string;
  gitUrl: string;
  gitBranch: string;
  imageName: string;
  imageTag: string;
  status: string;
  logs: string;
  duration: number;
  createdAt: string;
}

export default function BuildsPage() {
  const [builds, setBuilds] = useState<BuildJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("dockerfile");
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [imageName, setImageName] = useState("");
  const [imageTag, setImageTag] = useState("latest");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/builds");
      if (res.ok) setBuilds(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startBuild = async () => {
    if (!name) { toast.error("Nome é obrigatório"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source, gitUrl, gitBranch, imageName, imageTag }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Build ${data.status === "success" ? "concluído" : "falhou"}`);
        setShowForm(false); setName(""); setGitUrl("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setCreating(false); }
  };

  const deleteBuild = async (id: string) => {
    if (!confirm("Remover este build?")) return;
    await fetch(`/api/builds/${id}`, { method: "DELETE" });
    toast.success("Build removido");
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "success": return "bg-green-500/10 text-green-400";
      case "failed": return "bg-red-500/10 text-red-400";
      case "building": return "bg-blue-500/10 text-blue-400";
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
          <h2 className="text-2xl font-bold text-white">Build Server</h2>
          <p className="text-sm text-white/50 mt-1">Construa imagens Docker a partir de Dockerfile ou Git</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Build
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Build</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha API"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Fonte</label>
                <select value={source} onChange={(e) => setSource(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="dockerfile">Dockerfile</option>
                  <option value="git">Repositório Git</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Tag</label>
                <Input value={imageTag} onChange={(e) => setImageTag(e.target.value)} placeholder="latest"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            {source === "git" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">URL do Repositório</label>
                  <Input value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo.git"
                    className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Branch</label>
                  <Input value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} placeholder="main"
                    className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Nome da Imagem</label>
              <Input value={imageName} onChange={(e) => setImageName(e.target.value)} placeholder="minha-api (auto-gerado se vazio)"
                className="bg-white/5 border-white/10 text-white h-9 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={startBuild} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Hammer className="h-3.5 w-3.5 mr-1" />} Iniciar Build
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {builds.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Hammer className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum build realizado</p>
            <p className="text-xs text-white/25 mt-1">Construa imagens Docker a partir de código fonte</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar Build
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {builds.map((b) => (
            <Card key={b.id} className="bg-[#111] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${b.status === "success" ? "bg-green-500/10" : b.status === "failed" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                      {b.status === "success" ? <CheckCircle className="h-4 w-4 text-green-400" /> :
                       b.status === "failed" ? <XCircle className="h-4 w-4 text-red-400" /> :
                       <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{b.name}</span>
                        <Badge className={`border-0 text-[10px] ${statusColor(b.status)}`}>{b.status}</Badge>
                        <Badge className="border-0 text-[10px] bg-white/5 text-white/30">{b.imageName}:{b.imageTag}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                        {b.source === "git" && <span className="flex items-center gap-0.5"><GitBranch className="h-2.5 w-2.5" /> {b.gitBranch}</span>}
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {b.duration}ms</span>
                        <span>{new Date(b.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                      {expanded === b.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deleteBuild(b.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {expanded === b.id && b.logs && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <pre className="text-[10px] text-white/40 bg-black/30 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">{b.logs}</pre>
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
