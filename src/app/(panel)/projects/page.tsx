"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  RefreshCw,
  FolderOpen,
  Play,
  Square,
  Trash2,
  ExternalLink,
  Globe,
  Database,
  Zap,
  Server,
  Container,
} from "lucide-react";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  image: string;
  status: string;
  containerId: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  templateId: string;
  domain: string;
  createdAt: string;
  services: Service[];
}

const iconMap: Record<string, React.ReactNode> = {
  globe: <Globe className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  zap: <Zap className="h-5 w-5" />,
  server: <Server className="h-5 w-5" />,
  container: <Container className="h-5 w-5" />,
};

function getStatusColor(status: string) {
  switch (status) {
    case "running": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "stopped": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "partial": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "running": return "Rodando";
    case "stopped": return "Parado";
    case "partial": return "Parcial";
    default: return status;
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleAction = async (projectId: string, action: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchProjects();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro na ação");
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Tem certeza que deseja remover este projeto? Todos os containers serão removidos.")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Projeto removido");
        fetchProjects();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao remover projeto");
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projetos</h1>
          <p className="text-sm text-white/50">Gerencie seus projetos e deploys</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchProjects} className="border-white/10 text-white/70">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Link href="/projects/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Novo Projeto
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          placeholder="Buscar projetos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/50">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 text-white/10 mx-auto" />
            <p className="text-white/40 mt-4">Nenhum projeto encontrado</p>
            <p className="text-white/30 text-sm mt-1">Crie um novo projeto para começar</p>
            <Link href="/projects/new">
              <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> Criar Projeto
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Card key={project.id} className="bg-[#111] border-white/10 hover:border-white/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      {iconMap[project.templateId] || <FolderOpen className="h-5 w-5" />}
                    </div>
                    <div>
                      <Link href={`/projects/${project.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                        {project.name}
                      </Link>
                      <p className="text-xs text-white/40 mt-0.5">{project.type === "template" ? "Template" : "Custom"}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>

                {project.description && (
                  <p className="text-sm text-white/50 mb-3 line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-white/30 mb-4">
                  <span>{project.services.length} serviço(s)</span>
                  {project.domain && (
                    <>
                      <span>·</span>
                      <a href={`https://${project.domain}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                        {project.domain} <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {project.status === "stopped" ? (
                    <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2"
                      onClick={() => handleAction(project.id, "deploy")}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Deploy
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 h-8 px-2"
                      onClick={() => handleAction(project.id, "stop")}>
                      <Square className="h-3.5 w-3.5 mr-1" /> Parar
                    </Button>
                  )}
                  <Link href={`/projects/${project.id}`}>
                    <Button size="sm" variant="ghost" className="text-white/50 hover:text-white hover:bg-white/5 h-8 px-2">
                      Detalhes
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2 ml-auto"
                    onClick={() => handleDelete(project.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
