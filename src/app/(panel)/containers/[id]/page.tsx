"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ArrowLeft,
  ScrollText,
  Info,
  Network,
  HardDrive,
  Cpu,
  MemoryStick,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import ContainerLogs from "@/components/containers/container-logs";

interface ContainerDetail {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  running: boolean;
  created: string;
  started: string;
  finished: string;
  ports: {
    containerPort: string;
    hostBindings: { HostIp: string; HostPort: string }[];
  }[];
  env: string[];
  mounts: {
    type: string;
    source: string;
    destination: string;
    mode: string;
  }[];
  networks: string[];
  restartPolicy: { Name: string; MaximumRetryCount: number };
}

interface Stats {
  cpu: number;
  memory: { usage: number; limit: number; percent: number };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ContainerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEnvValues, setShowEnvValues] = useState(false);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await fetch(`/api/containers/${id}`);
      if (res.ok) {
        setContainer(await res.json());
      } else {
        toast.error("Container não encontrado");
        router.push("/containers");
      }
    } catch {
      toast.error("Erro ao carregar container");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchStats = useCallback(async () => {
    if (!container?.running) return;
    try {
      const res = await fetch(`/api/containers/${id}/stats`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* ignore */
    }
  }, [id, container?.running]);

  useEffect(() => {
    fetchContainer();
  }, [fetchContainer]);

  useEffect(() => {
    if (container?.running) {
      fetchStats();
      const interval = setInterval(fetchStats, 3000);
      return () => clearInterval(interval);
    }
  }, [container?.running, fetchStats]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/containers/${id}/${action}`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(`${action} executado com sucesso`);
        await fetchContainer();
      } else {
        const data = await res.json();
        toast.error(data.error || `Erro ao executar ${action}`);
      }
    } catch {
      toast.error(`Erro ao executar ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(
        `Tem certeza que deseja remover o container "${container?.name}"?`
      )
    )
      return;
    setActionLoading("remove");
    try {
      const res = await fetch(`/api/containers/${id}?force=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Container removido");
        router.push("/containers");
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao remover");
      }
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !container) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/containers")}
          className="text-white/50 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                container.running
                  ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                  : "bg-red-400"
              }`}
            />
            <h2 className="text-2xl font-bold text-white">{container.name}</h2>
            <Badge
              variant={container.running ? "default" : "destructive"}
            >
              {container.state}
            </Badge>
          </div>
          <p className="text-sm text-white/40 mt-1 font-mono">
            {container.shortId} &middot; {container.image}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchContainer}
            className="border-white/10 text-white/70 hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          {!container.running && (
            <Button
              size="sm"
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20"
              onClick={() => handleAction("start")}
              disabled={actionLoading === "start"}
            >
              <Play className="h-4 w-4 mr-1" />
              Iniciar
            </Button>
          )}
          {container.running && (
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => handleAction("stop")}
              disabled={actionLoading === "stop"}
            >
              <Square className="h-4 w-4 mr-1" />
              Parar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
            onClick={() => handleAction("restart")}
            disabled={actionLoading === "restart"}
          >
            <RotateCw className="h-4 w-4 mr-1" />
            Reiniciar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/20 text-red-400 hover:bg-red-500/10"
            onClick={handleRemove}
            disabled={actionLoading === "remove"}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
        </div>
      </div>

      {container.running && stats && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> CPU
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.cpu.toFixed(1)}%
                  </p>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke={stats.cpu > 80 ? "#f87171" : "#60a5fa"}
                      strokeWidth="4"
                      strokeDasharray={`${(stats.cpu / 100) * 175.9} 175.9`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 flex items-center gap-1">
                    <MemoryStick className="h-3 w-3" /> Memória
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatBytes(stats.memory.usage)}
                  </p>
                  <p className="text-xs text-white/30">
                    / {formatBytes(stats.memory.limit)} (
                    {stats.memory.percent.toFixed(1)}%)
                  </p>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke={
                        stats.memory.percent > 80 ? "#f87171" : "#a78bfa"
                      }
                      strokeWidth="4"
                      strokeDasharray={`${
                        (stats.memory.percent / 100) * 175.9
                      } 175.9`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger
            value="logs"
            className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60"
          >
            <ScrollText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60"
          >
            <Info className="h-4 w-4 mr-2" />
            Informações
          </TabsTrigger>
          <TabsTrigger
            value="network"
            className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60"
          >
            <Network className="h-4 w-4 mr-2" />
            Rede
          </TabsTrigger>
          <TabsTrigger
            value="volumes"
            className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60"
          >
            <HardDrive className="h-4 w-4 mr-2" />
            Volumes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <ContainerLogs containerId={id} />
        </TabsContent>

        <TabsContent value="info">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white">
                Informações do Container
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/40">ID</p>
                  <p className="text-sm text-white font-mono mt-0.5">
                    {container.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Imagem</p>
                  <p className="text-sm text-white mt-0.5">{container.image}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Criado em</p>
                  <p className="text-sm text-white mt-0.5">
                    {new Date(container.created).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Restart Policy</p>
                  <p className="text-sm text-white mt-0.5">
                    {container.restartPolicy?.Name || "no"}
                  </p>
                </div>
                {container.started && (
                  <div>
                    <p className="text-xs text-white/40">Iniciado em</p>
                    <p className="text-sm text-white mt-0.5">
                      {new Date(container.started).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>

              {container.env.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-white/40">
                      Variáveis de Ambiente
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-white/40 hover:text-white"
                      onClick={() => setShowEnvValues(!showEnvValues)}
                    >
                      {showEnvValues ? (
                        <><EyeOff className="h-3 w-3 mr-1" /> Ocultar</>
                      ) : (
                        <><Eye className="h-3 w-3 mr-1" /> Revelar</>
                      )}
                    </Button>
                  </div>
                  <div className="bg-black/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {container.env.map((envVar, i) => {
                      const eqIdx = envVar.indexOf("=");
                      const key = eqIdx > -1 ? envVar.substring(0, eqIdx) : envVar;
                      const value = eqIdx > -1 ? envVar.substring(eqIdx + 1) : "";
                      const isSensitive = /password|secret|token|key|api_key|apikey|credential|auth/i.test(key);
                      const masked = isSensitive && !showEnvValues;
                      return (
                        <p key={i} className="text-xs text-white/60 font-mono">
                          {key}={masked ? "••••••••" : value}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white">
                Configuração de Rede
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-white/40 mb-2">Redes</p>
                <div className="flex gap-2">
                  {container.networks.map((network) => (
                    <Badge
                      key={network}
                      variant="outline"
                      className="border-white/10 text-white/60"
                    >
                      {network}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2">Portas</p>
                {container.ports.length > 0 ? (
                  <div className="space-y-1">
                    {container.ports.map((port, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-white/60"
                      >
                        <span className="font-mono">
                          {port.containerPort}
                        </span>
                        {port.hostBindings.length > 0 && (
                          <>
                            <span className="text-white/20">&rarr;</span>
                            {port.hostBindings.map((b, j) => (
                              <Badge
                                key={j}
                                variant="secondary"
                                className="text-xs"
                              >
                                {b.HostIp || "0.0.0.0"}:{b.HostPort}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/30">
                    Nenhuma porta mapeada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volumes">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white">
                Volumes e Montagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              {container.mounts.length > 0 ? (
                <div className="space-y-3">
                  {container.mounts.map((mount, i) => (
                    <div
                      key={i}
                      className="bg-black/50 rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-white/10 text-white/40"
                        >
                          {mount.type}
                        </Badge>
                        {mount.mode && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-white/10 text-white/40"
                          >
                            {mount.mode}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-white/60 font-mono">
                        {mount.source} &rarr; {mount.destination}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30">
                  Nenhum volume montado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
