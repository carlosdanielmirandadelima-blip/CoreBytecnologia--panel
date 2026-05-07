"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  ArrowDown,
  ArrowUp,
  Clock,
  FolderOpen,
  Play,
  Square,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface SystemStats {
  cpu: { cores: number; model: string; percent: number };
  memory: { total: number; used: number; free: number; percent: number };
  disk: { total: number; used: number; free: number; percent: number };
  network: { rxBytes: number; txBytes: number };
  uptime: number;
  hostname: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  templateId: string;
  domain: string;
  services: { id: string; name: string; status: string }[];
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "running": return "bg-green-500";
    case "stopped": return "bg-gray-500";
    case "error": return "bg-red-500";
    case "deploying": return "bg-yellow-500";
    default: return "bg-gray-500";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "running": return "Rodando";
    case "stopped": return "Parado";
    case "error": return "Erro";
    case "deploying": return "Deployando";
    default: return status;
  }
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-yellow-500";
  return "bg-blue-500";
}

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, projectsRes] = await Promise.all([
        fetch("/api/system/stats"),
        fetch("/api/projects"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleProjectAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/${action}`, { method: "POST" });
      if (res.ok) {
        toast.success(action === "deploy" || action === "start" ? "Projeto iniciado!" : "Projeto parado!");
        fetchData();
      }
    } catch {
      toast.error("Erro na ação");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Remover este projeto e todos os seus containers?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Projeto removido"); fetchData(); }
    } catch { toast.error("Erro ao remover"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Server className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{stats?.hostname || "Servidor"}</h2>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatUptime(stats?.uptime ?? 0)}</span>
              <span>{stats?.cpu.cores || 0} vCPUs</span>
              <span>{formatBytes(stats?.memory.total ?? 0)} RAM</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Resource Usage - EasyPanel Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-white/70">CPU</span>
              </div>
              <span className="text-sm font-semibold text-white">{stats?.cpu.percent ?? 0}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(stats?.cpu.percent ?? 0)}`}
                style={{ width: `${stats?.cpu.percent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-green-400" />
                <span className="text-sm text-white/70">Memória</span>
              </div>
              <span className="text-sm font-semibold text-white">{stats?.memory.percent ?? 0}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(stats?.memory.percent ?? 0)}`}
                style={{ width: `${stats?.memory.percent ?? 0}%` }} />
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">{formatBytes(stats?.memory.used ?? 0)} / {formatBytes(stats?.memory.total ?? 0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-white/70">Disco</span>
              </div>
              <span className="text-sm font-semibold text-white">{stats?.disk.percent ?? 0}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(stats?.disk.percent ?? 0)}`}
                style={{ width: `${stats?.disk.percent ?? 0}%` }} />
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">{formatBytes(stats?.disk.used ?? 0)} / {formatBytes(stats?.disk.total ?? 0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-white/70">Rede</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <ArrowDown className="h-3 w-3 text-green-400" /> Download
                </span>
                <span className="text-xs text-white font-medium">{formatBytes(stats?.network.rxBytes ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <ArrowUp className="h-3 w-3 text-blue-400" /> Upload
                </span>
                <span className="text-xs text-white font-medium">{formatBytes(stats?.network.txBytes ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section - EasyPanel Style */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-white/50" /> Projetos
          </h3>
          <Link href="/projects/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Projeto
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="bg-[#111] border-white/10 border-dashed">
            <CardContent className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-white/10 mx-auto" />
              <p className="text-sm text-white/40 mt-3">Nenhum projeto criado</p>
              <p className="text-xs text-white/25 mt-1">Crie um projeto a partir de templates ou containers customizados</p>
              <Link href="/projects/new">
                <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Projeto
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <Card key={project.id} className="bg-[#111] border-white/10 hover:border-white/20 transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(project.status)}`} />
                        <h4 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                          {project.name}
                        </h4>
                      </div>
                      {project.description && (
                        <p className="text-xs text-white/30 mt-1 truncate ml-4">{project.description}</p>
                      )}
                    </Link>
                  </div>

                  <div className="flex items-center gap-2 mb-3 ml-4">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                      {project.type === "template" ? project.templateId : project.type}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {project.services.length} serviço{project.services.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {getStatusLabel(project.status)}
                    </span>
                  </div>

                  {project.domain && (
                    <p className="text-xs text-blue-400/60 mb-3 ml-4 truncate">{project.domain}</p>
                  )}

                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                    {project.status === "running" ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleProjectAction(project.id, "stop")}>
                        <Square className="h-3 w-3 mr-1" /> Parar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        onClick={() => handleProjectAction(project.id, "deploy")}>
                        <Play className="h-3 w-3 mr-1" /> Deploy
                      </Button>
                    )}
                    <Link href={`/projects/${project.id}`} className="ml-auto">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-white/40 hover:text-white">
                        Detalhes →
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDeleteProject(project.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
