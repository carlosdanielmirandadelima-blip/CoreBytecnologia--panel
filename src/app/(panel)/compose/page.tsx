"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Play,
  Loader2,
  FileCode,
  Eye,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface ComposeService {
  name: string;
  image: string;
  ports: string;
  volumes: string;
  environment: { key: string; value: string }[];
  command: string;
  restart: string;
}

function generateComposeYaml(projectName: string, services: ComposeService[]): string {
  let yaml = `version: "3.8"\n\nservices:\n`;
  for (const svc of services) {
    yaml += `  ${svc.name}:\n`;
    yaml += `    image: ${svc.image}\n`;
    if (svc.restart) yaml += `    restart: ${svc.restart}\n`;
    if (svc.command) yaml += `    command: ${svc.command}\n`;
    if (svc.ports) {
      yaml += `    ports:\n`;
      for (const port of svc.ports.split(",")) {
        yaml += `      - "${port.trim()}"\n`;
      }
    }
    if (svc.volumes) {
      yaml += `    volumes:\n`;
      for (const vol of svc.volumes.split(",")) {
        yaml += `      - ${vol.trim()}\n`;
      }
    }
    if (svc.environment.length > 0) {
      yaml += `    environment:\n`;
      for (const env of svc.environment) {
        if (env.key) yaml += `      ${env.key}: "${env.value}"\n`;
      }
    }
    yaml += `\n`;
  }

  const volumeNames = new Set<string>();
  for (const svc of services) {
    if (svc.volumes) {
      for (const vol of svc.volumes.split(",")) {
        const name = vol.trim().split(":")[0];
        if (name && !name.startsWith("/") && !name.startsWith(".")) {
          volumeNames.add(name);
        }
      }
    }
  }
  if (volumeNames.size > 0) {
    yaml += `volumes:\n`;
    for (const name of volumeNames) {
      yaml += `  ${name}:\n`;
    }
  }

  return yaml;
}

export default function ComposeEditorPage() {
  const router = useRouter();
  const [tab, setTab] = useState("visual");
  const [projectName, setProjectName] = useState("");
  const [services, setServices] = useState<ComposeService[]>([
    {
      name: "app",
      image: "",
      ports: "",
      volumes: "",
      environment: [],
      command: "",
      restart: "unless-stopped",
    },
  ]);
  const [yamlContent, setYamlContent] = useState("");
  const [loading, setLoading] = useState(false);

  const addService = () => {
    setServices([
      ...services,
      {
        name: `service-${services.length + 1}`,
        image: "",
        ports: "",
        volumes: "",
        environment: [],
        command: "",
        restart: "unless-stopped",
      },
    ]);
  };

  const removeService = (index: number) => {
    if (services.length <= 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: keyof ComposeService, value: string) => {
    const updated = [...services];
    (updated[index] as Record<string, unknown>)[field] = value;
    setServices(updated);
  };

  const addEnv = (svcIndex: number) => {
    const updated = [...services];
    updated[svcIndex].environment.push({ key: "", value: "" });
    setServices(updated);
  };

  const removeEnv = (svcIndex: number, envIndex: number) => {
    const updated = [...services];
    updated[svcIndex].environment = updated[svcIndex].environment.filter((_, i) => i !== envIndex);
    setServices(updated);
  };

  const updateEnv = (svcIndex: number, envIndex: number, field: "key" | "value", val: string) => {
    const updated = [...services];
    updated[svcIndex].environment[envIndex][field] = val;
    setServices(updated);
  };

  const previewYaml = () => {
    setYamlContent(generateComposeYaml(projectName, services));
    setTab("yaml");
  };

  const handleDeploy = async () => {
    if (!projectName) {
      toast.error("Nome do projeto é obrigatório");
      return;
    }
    if (services.some((s) => !s.name || !s.image)) {
      toast.error("Todos os serviços precisam de nome e imagem");
      return;
    }

    setLoading(true);
    try {
      const envVars: { key: string; value: string }[] = [];
      for (const svc of services) {
        for (const env of svc.environment) {
          if (env.key) envVars.push({ key: env.key, value: env.value });
        }
      }

      const compose = generateComposeYaml(projectName, services);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          type: "compose",
          composeFile: compose,
          services: services.map((s) => ({
            name: s.name,
            image: s.image,
            ports: s.ports,
            volumes: s.volumes,
            command: s.command,
          })),
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileCode className="h-6 w-6 text-blue-400" /> Editor Compose
        </h1>
        <p className="text-sm text-white/50">Crie projetos visualmente com múltiplos serviços</p>
      </div>

      <div className="space-y-2">
        <Label className="text-white/70">Nome do Projeto</Label>
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-white/5 border-white/10 text-white max-w-md"
          placeholder="meu-projeto"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="visual" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Editor Visual
          </TabsTrigger>
          <TabsTrigger value="yaml" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            YAML Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="mt-4 space-y-4">
          {services.map((svc, svcIndex) => (
            <Card key={svcIndex} className="bg-[#111] border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base">
                    Serviço: {svc.name || `#${svcIndex + 1}`}
                  </CardTitle>
                  {services.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-red-400 h-7"
                      onClick={() => removeService(svcIndex)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Nome do Serviço</Label>
                    <Input value={svc.name}
                      onChange={(e) => updateService(svcIndex, "name", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="app" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Imagem Docker</Label>
                    <Input value={svc.image}
                      onChange={(e) => updateService(svcIndex, "image", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="nginx:latest" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Portas (host:container)</Label>
                    <Input value={svc.ports}
                      onChange={(e) => updateService(svcIndex, "ports", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="8080:80" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Volumes</Label>
                    <Input value={svc.volumes}
                      onChange={(e) => updateService(svcIndex, "volumes", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="data:/app/data" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Comando</Label>
                    <Input value={svc.command}
                      onChange={(e) => updateService(svcIndex, "command", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="opcional" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">Restart Policy</Label>
                    <Input value={svc.restart}
                      onChange={(e) => updateService(svcIndex, "restart", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="unless-stopped" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/60 text-xs">Variáveis de Ambiente</Label>
                    <Button variant="ghost" size="sm" className="text-blue-400 h-6 text-xs"
                      onClick={() => addEnv(svcIndex)}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {svc.environment.map((env, envIndex) => (
                    <div key={envIndex} className="flex gap-2">
                      <Input value={env.key}
                        onChange={(e) => updateEnv(svcIndex, envIndex, "key", e.target.value)}
                        className="bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="KEY" />
                      <Input value={env.value}
                        onChange={(e) => updateEnv(svcIndex, envIndex, "value", e.target.value)}
                        className="bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="value" />
                      <Button variant="ghost" size="icon" className="text-red-400 h-8 w-8 shrink-0"
                        onClick={() => removeEnv(svcIndex, envIndex)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full border-dashed border-white/10 text-white/50 hover:text-white hover:border-white/20"
            onClick={addService}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Serviço
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" className="border-white/10 text-white/70" onClick={previewYaml}>
              <Eye className="h-4 w-4 mr-2" /> Preview YAML
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleDeploy} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Criar e Fazer Deploy
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="yaml" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">docker-compose.yml</CardTitle>
                <Button variant="ghost" size="sm" className="text-white/50"
                  onClick={() => {
                    navigator.clipboard.writeText(yamlContent || generateComposeYaml(projectName, services));
                    toast.success("YAML copiado!");
                  }}>
                  <Save className="h-4 w-4 mr-1" /> Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/50 p-4 rounded-lg text-sm text-green-400 font-mono overflow-x-auto whitespace-pre">
                {yamlContent || generateComposeYaml(projectName, services)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
