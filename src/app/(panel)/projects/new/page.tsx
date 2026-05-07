"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Globe,
  Database,
  Zap,
  Server,
  Container,
  HardDrive,
  Activity,
  Workflow,
  Plus,
  Trash2,
  Loader2,
  GitBranch,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  services: { name: string; image: string; ports: string; volumes: string; command: string }[];
  envVars: { key: string; value: string; description: string }[];
}

const iconMap: Record<string, React.ReactNode> = {
  globe: <Globe className="h-6 w-6" />,
  database: <Database className="h-6 w-6" />,
  zap: <Zap className="h-6 w-6" />,
  server: <Server className="h-6 w-6" />,
  container: <Container className="h-6 w-6" />,
  "hard-drive": <HardDrive className="h-6 w-6" />,
  activity: <Activity className="h-6 w-6" />,
  workflow: <Workflow className="h-6 w-6" />,
};

export default function NewProjectPage() {
  const router = useRouter();
  const [tab, setTab] = useState("template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  // Custom project fields
  const [customImage, setCustomImage] = useState("");
  const [customPorts, setCustomPorts] = useState("");
  const [customVolumes, setCustomVolumes] = useState("");

  // Environment
  const [environment, setEnvironment] = useState("production");

  // Git deploy fields
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Erro ao carregar templates"));
  }, []);

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setName(template.name.toLowerCase().replace(/\s+/g, "-"));
    setDescription(template.description);
    setEnvVars(template.envVars.map((ev) => ({ key: ev.key, value: ev.value })));
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
  };

  const handleCreateTemplate = async () => {
    if (!name || !selectedTemplate) {
      toast.error("Selecione um template e defina um nome");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: "template",
          templateId: selectedTemplate.id,
          environment,
          envVars,
        }),
      });
      if (res.ok) {
        const project = await res.json();
        toast.success("Projeto criado! Iniciando deploy...");
        await fetch(`/api/projects/${project.id}/deploy`, { method: "POST" });
        router.push(`/projects/${project.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!name || !customImage) {
      toast.error("Nome e imagem são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type: "custom",
          environment,
          services: [{
            name: name,
            image: customImage,
            ports: customPorts,
            volumes: customVolumes,
          }],
          envVars,
        }),
      });
      if (res.ok) {
        const project = await res.json();
        toast.success("Projeto criado! Iniciando deploy...");
        await fetch(`/api/projects/${project.id}/deploy`, { method: "POST" });
        router.push(`/projects/${project.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGit = async () => {
    if (!name || !gitUrl) {
      toast.error("Nome e URL do repositório são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type: "git",
          gitUrl,
          branch: gitBranch,
          environment,
          envVars,
        }),
      });
      if (res.ok) {
        const project = await res.json();
        toast.success("Projeto criado com repositório Git!");
        router.push(`/projects/${project.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  };

  const templatesByCategory: Record<string, Template[]> = {};
  for (const t of templates) {
    if (!templatesByCategory[t.category]) templatesByCategory[t.category] = [];
    templatesByCategory[t.category].push(t);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Novo Projeto</h1>
          <p className="text-sm text-white/50">Escolha como criar seu projeto</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="template" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Templates
          </TabsTrigger>
          <TabsTrigger value="custom" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Container Custom
          </TabsTrigger>
          <TabsTrigger value="git" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Git Deploy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="mt-6 space-y-6">
          {!selectedTemplate ? (
            <>
              {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="bg-[#111] border-white/10 hover:border-blue-500/50 cursor-pointer transition-colors"
                        onClick={() => selectTemplate(template)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                            {iconMap[template.icon] || <Container className="h-6 w-6" />}
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{template.name}</h4>
                            <p className="text-sm text-white/40">{template.description}</p>
                            <div className="flex gap-1 mt-1">
                              {template.services.map((s) => (
                                <Badge key={s.name} variant="outline" className="text-[10px] text-white/30 border-white/10">
                                  {s.image.split(":")[0]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <Card className="bg-[#111] border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                      {iconMap[selectedTemplate.icon] || <Container className="h-6 w-6" />}
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">{selectedTemplate.name}</CardTitle>
                      <p className="text-sm text-white/40">{selectedTemplate.description}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white/50" onClick={() => setSelectedTemplate(null)}>
                    Trocar template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Nome do Projeto</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="meu-projeto"
                  />
                </div>

                {envVars.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-white/70">Variáveis de Ambiente</Label>
                    <div className="space-y-2">
                      {envVars.map((ev, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={ev.key}
                            onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                            className="bg-white/5 border-white/10 text-white font-mono text-sm"
                            placeholder="KEY"
                          />
                          <Input
                            value={ev.value}
                            onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                            className="bg-white/5 border-white/10 text-white font-mono text-sm"
                            placeholder="value"
                          />
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 shrink-0"
                            onClick={() => removeEnvVar(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-white/30 p-3 bg-white/5 rounded-lg">
                  <p className="font-medium text-white/50 mb-1">Serviços que serão criados:</p>
                  {selectedTemplate.services.map((s) => (
                    <p key={s.name}>{s.name} — {s.image} {s.ports && `(${s.ports})`}</p>
                  ))}
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCreateTemplate}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Criar e Fazer Deploy
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Container Customizado</CardTitle>
              <p className="text-sm text-white/40">Deploy de qualquer imagem Docker</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Nome do Projeto</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="meu-app" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Imagem Docker</Label>
                  <Input value={customImage} onChange={(e) => setCustomImage(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="nginx:latest" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="Descrição do projeto" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Ambiente</Label>
                  <select value={environment} onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Portas (host:container)</Label>
                  <Input value={customPorts} onChange={(e) => setCustomPorts(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="8080:80" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Volumes</Label>
                  <Input value={customVolumes} onChange={(e) => setCustomVolumes(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="data:/app/data" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white/70">Variáveis de Ambiente</Label>
                  <Button variant="ghost" size="sm" className="text-blue-400 h-7" onClick={addEnvVar}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {envVars.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={ev.key} onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="KEY" />
                    <Input value={ev.value} onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="value" />
                    <Button variant="ghost" size="icon" className="text-red-400 shrink-0" onClick={() => removeEnvVar(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreateCustom} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Criar e Fazer Deploy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="git" className="mt-6">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-400" /> Git Deploy
              </CardTitle>
              <p className="text-sm text-white/40">Deploy a partir de um repositório Git</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Nome do Projeto</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" placeholder="meu-app" />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">URL do Repositório</Label>
                <Input value={gitUrl} onChange={(e) => setGitUrl(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" placeholder="https://github.com/user/repo.git" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Branch</Label>
                  <Input value={gitBranch} onChange={(e) => setGitBranch(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="main" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="Descrição" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white/70">Variáveis de Ambiente</Label>
                  <Button variant="ghost" size="sm" className="text-blue-400 h-7" onClick={addEnvVar}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {envVars.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={ev.key} onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="KEY" />
                    <Input value={ev.value} onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="value" />
                    <Button variant="ghost" size="icon" className="text-red-400 shrink-0" onClick={() => removeEnvVar(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="text-xs text-white/30 p-3 bg-white/5 rounded-lg">
                O sistema vai clonar o repositório, detectar o Dockerfile ou docker-compose.yml, e fazer o build + deploy automaticamente.
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreateGit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
                Criar Projeto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
