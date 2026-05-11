"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Plus,
  Save,
  Loader2,
  Container,
  Settings,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  image: string;
  status: string;
  containerId: string;
  ports: string;
  volumes: string;
  command: string;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  templateId: string;
  gitUrl: string;
  branch: string;
  domain: string;
  composeFile: string;
  createdAt: string;
  updatedAt: string;
  services: Service[];
  envVars: EnvVar[];
}

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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [editEnvVars, setEditEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [editDomain, setEditDomain] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (!res.ok) {
        router.push("/projects");
        return;
      }
      const data = await res.json();
      setProject(data);
      if (editEnvVars.length === 0) {
        setEditEnvVars(data.envVars.map((ev: EnvVar) => ({ key: ev.key, value: ev.value })));
        setEditDomain(data.domain || "");
      }
    } catch {
      toast.error("Erro ao carregar projeto");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, editEnvVars.length]);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(fetchProject, 5000);
    return () => clearInterval(interval);
  }, [fetchProject]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/projects/${params.id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchProject();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro na ação");
    } finally {
      setActionLoading("");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza? Todos os containers do projeto serão removidos permanentemente.")) return;
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Projeto removido");
        router.push("/projects");
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: editDomain,
          envVars: editEnvVars,
        }),
      });
      if (res.ok) {
        toast.success("Configurações salvas! Faça redeploy para aplicar.");
        fetchProject();
      } else {
        toast.error("Erro ao salvar");
      }
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <Badge className={getStatusColor(project.status)}>
                {getStatusLabel(project.status)}
              </Badge>
              <Badge className={project.environment === "production" ? "bg-red-500/10 text-red-400 border-0" : project.environment === "staging" ? "bg-yellow-500/10 text-yellow-400 border-0" : "bg-blue-500/10 text-blue-400 border-0"}>
                {project.environment || "production"}
              </Badge>
            </div>
            <p className="text-sm text-white/50">
              {project.type === "template" ? `Template: ${project.templateId}` : project.type === "git" ? `Git: ${project.gitUrl}` : "Projeto customizado"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {project.status === "running" ? (
            <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => handleAction("stop")} disabled={!!actionLoading}>
              {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Square className="h-4 w-4 mr-1" />}
              Parar
            </Button>
          ) : (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleAction("deploy")} disabled={!!actionLoading}>
              {actionLoading === "deploy" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Deploy
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            onClick={() => handleAction("redeploy")} disabled={!!actionLoading}>
            {actionLoading === "redeploy" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Redeploy
          </Button>
          <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="services" className="data-[state=active]:bg-white/10">
            <Container className="h-4 w-4 mr-1" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="env" className="data-[state=active]:bg-white/10">
            <Settings className="h-4 w-4 mr-1" /> Variáveis
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white/10">
            <Globe className="h-4 w-4 mr-1" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4 space-y-3">
          {project.services.length === 0 ? (
            <Card className="bg-[#111] border-white/10">
              <CardContent className="py-8 text-center text-white/40">
                Nenhum serviço configurado
              </CardContent>
            </Card>
          ) : (
            project.services.map((service) => (
              <Card key={service.id} className="bg-[#111] border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${service.status === "running" ? "bg-green-400" : "bg-red-400"}`} />
                      <div>
                        <p className="text-white font-medium">{service.name}</p>
                        <p className="text-xs text-white/40">{service.image}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/40">
                      {service.ports && <span>Portas: {service.ports}</span>}
                      {service.containerId && (
                        <Link href={`/containers/${service.containerId}`}>
                          <Button variant="ghost" size="sm" className="text-blue-400 h-7 text-xs">
                            Ver Container
                          </Button>
                        </Link>
                      )}
                      <Badge className={service.status === "running" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                        {service.status === "running" ? "Rodando" : "Parado"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="env" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Variáveis de Ambiente</CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-400 h-7"
                  onClick={() => setEditEnvVars([...editEnvVars, { key: "", value: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {editEnvVars.map((ev, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={ev.key}
                    onChange={(e) => {
                      const updated = [...editEnvVars];
                      updated[i].key = e.target.value;
                      setEditEnvVars(updated);
                    }}
                    className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="KEY" />
                  <Input value={ev.value}
                    onChange={(e) => {
                      const updated = [...editEnvVars];
                      updated[i].value = e.target.value;
                      setEditEnvVars(updated);
                    }}
                    className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="value" />
                  <Button variant="ghost" size="icon" className="text-red-400 shrink-0"
                    onClick={() => setEditEnvVars(editEnvVars.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {editEnvVars.length === 0 && (
                <p className="text-sm text-white/30 text-center py-4">Nenhuma variável configurada</p>
              )}
              <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Variáveis
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Configurações do Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Domínio</Label>
                <Input value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="app.meudominio.com" />
                <p className="text-xs text-white/30">Configure o DNS antes de ativar o domínio</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-xs text-white/40">Tipo</p>
                  <p className="text-sm text-white">{project.type}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Criado em</p>
                  <p className="text-sm text-white">{new Date(project.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                {project.gitUrl && (
                  <div className="col-span-2">
                    <p className="text-xs text-white/40">Repositório</p>
                    <p className="text-sm text-white">{project.gitUrl} ({project.branch})</p>
                  </div>
                )}
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
