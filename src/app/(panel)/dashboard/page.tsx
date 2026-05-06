"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Container,
  Play,
  Square,
  Pause,
  Server,
  HardDrive,
  Cpu,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface ContainerInfo {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: { privatePort: number; publicPort?: number; type: string }[];
}

interface SystemInfo {
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  serverVersion: string;
  operatingSystem: string;
  totalMemory: number;
  cpus: number;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function StateIcon({ state }: { state: string }) {
  switch (state) {
    case "running":
      return <Play className="h-3 w-3 fill-current" />;
    case "exited":
      return <Square className="h-3 w-3" />;
    case "paused":
      return <Pause className="h-3 w-3" />;
    default:
      return <Square className="h-3 w-3" />;
  }
}

function stateBadgeVariant(
  state: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "running":
      return "default";
    case "exited":
      return "destructive";
    case "paused":
      return "secondary";
    default:
      return "outline";
  }
}

export default function DashboardPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [containersRes, systemRes] = await Promise.all([
        fetch("/api/containers"),
        fetch("/api/system"),
      ]);
      if (containersRes.ok) setContainers(await containersRes.json());
      if (systemRes.ok) setSystemInfo(await systemRes.json());
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    {
      label: "Total de Containers",
      value: systemInfo?.containers || 0,
      icon: Container,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Em Execução",
      value: systemInfo?.containersRunning || 0,
      icon: Play,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Parados",
      value: systemInfo?.containersStopped || 0,
      icon: Square,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
    {
      label: "Imagens",
      value: systemInfo?.images || 0,
      icon: HardDrive,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-white/50 mt-1">
            Visão geral do seu servidor Docker
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="bg-[#111] border-white/10"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/50">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {systemInfo && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-white/50" />
              Informações do Servidor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-white/40">Docker</p>
                <p className="text-sm text-white mt-0.5">
                  v{systemInfo.serverVersion}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Sistema</p>
                <p className="text-sm text-white mt-0.5">
                  {systemInfo.operatingSystem}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> CPUs
                </p>
                <p className="text-sm text-white mt-0.5">{systemInfo.cpus}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Memória Total</p>
                <p className="text-sm text-white mt-0.5">
                  {formatBytes(systemInfo.totalMemory)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#111] border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Container className="h-4 w-4 text-white/50" />
              Containers Recentes
            </CardTitle>
            <Link href="/containers">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white"
              >
                Ver todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {containers.length === 0 ? (
            <div className="text-center py-8">
              <Container className="h-12 w-12 text-white/10 mx-auto" />
              <p className="text-sm text-white/40 mt-3">
                Nenhum container encontrado
              </p>
              <p className="text-xs text-white/30 mt-1">
                Os containers Docker aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {containers.slice(0, 8).map((container) => (
                <Link
                  key={container.id}
                  href={`/containers/${container.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        container.state === "running"
                          ? "bg-green-400"
                          : container.state === "exited"
                          ? "bg-red-400"
                          : "bg-yellow-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                        {container.name}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {container.image}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={stateBadgeVariant(container.state)}
                      className="text-[10px] gap-1"
                    >
                      <StateIcon state={container.state} />
                      {container.state}
                    </Badge>
                    <span className="text-[10px] text-white/30 font-mono">
                      {container.shortId}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
