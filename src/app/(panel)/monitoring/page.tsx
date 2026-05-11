"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Cpu, MemoryStick, HardDrive, Network, RefreshCw,
  ArrowDown, ArrowUp, Clock, Server, Heart, AlertTriangle,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface SystemStats {
  timestamp: number;
  cpu: { cores: number; model: string; percent: number };
  memory: { total: number; used: number; free: number; percent: number };
  disk: { total: number; used: number; free: number; percent: number };
  network: { rxBytes: number; txBytes: number };
  load: { load1: number; load5: number; load15: number };
  uptime: number;
  hostname: string;
}

interface ContainerStats {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu: number;
  memory: { usage: number; limit: number; percent: number };
  network: { rxBytes: number; txBytes: number };
  health: string;
}

interface HistoryPoint {
  time: string;
  cpu: number;
  memory: number;
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
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#06b6d4", "#f97316", "#ec4899"];

export default function MonitoringPage() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [containerStats, setContainerStats] = useState<ContainerStats[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [sysRes, containerRes] = await Promise.all([
        fetch("/api/system/stats"),
        fetch("/api/containers/stats"),
      ]);
      const sysData = await sysRes.json();
      const containerData = await containerRes.json();

      if (!sysData.error) {
        setSystemStats(sysData);
        setHistory((prev) => {
          const point = {
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            cpu: sysData.cpu.percent,
            memory: sysData.memory.percent,
          };
          const updated = [...prev, point];
          return updated.slice(-30);
        });
      }
      if (Array.isArray(containerData)) setContainerStats(containerData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  const diskData = systemStats ? [
    { name: "Usado", value: systemStats.disk.used },
    { name: "Livre", value: systemStats.disk.free },
  ] : [];

  const memData = systemStats ? [
    { name: "Usado", value: systemStats.memory.used },
    { name: "Livre", value: systemStats.memory.free },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-400" /> Monitoramento
          </h1>
          <p className="text-sm text-white/50">
            {systemStats?.hostname || "Servidor"} &middot; Atualização a cada 3s
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            className={`border-white/10 ${autoRefresh ? "text-green-400" : "text-white/50"}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto: ON" : "Auto: OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStats} className="border-white/10 text-white/70">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">CPU</span>
              <Cpu className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{systemStats?.cpu.percent ?? 0}%</p>
            <p className="text-xs text-white/30">{systemStats?.cpu.cores || 0} cores</p>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${systemStats?.cpu.percent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Memória</span>
              <MemoryStick className="h-4 w-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">{systemStats?.memory.percent ?? 0}%</p>
            <p className="text-xs text-white/30">{formatBytes(systemStats?.memory.used ?? 0)} / {formatBytes(systemStats?.memory.total ?? 0)}</p>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${systemStats?.memory.percent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Disco</span>
              <HardDrive className="h-4 w-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-white">{systemStats?.disk.percent ?? 0}%</p>
            <p className="text-xs text-white/30">{formatBytes(systemStats?.disk.used ?? 0)} / {formatBytes(systemStats?.disk.total ?? 0)}</p>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${systemStats?.disk.percent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Rede</span>
              <Network className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-center gap-1 text-sm text-white">
              <ArrowDown className="h-3 w-3 text-green-400" />
              <span className="font-medium">{formatBytes(systemStats?.network.rxBytes ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-white mt-0.5">
              <ArrowUp className="h-3 w-3 text-blue-400" />
              <span className="font-medium">{formatBytes(systemStats?.network.txBytes ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-white/30">
              <Clock className="h-3 w-3" /> Uptime: {formatUptime(systemStats?.uptime ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">CPU & Memória (Histórico)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" tick={{ fill: "#ffffff40", fontSize: 10 }} />
                <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" fill="#3b82f680" strokeWidth={2} />
                <Area type="monotone" dataKey="memory" name="Memória %" stroke="#22c55e" fill="#22c55e80" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Uso de Recursos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={memData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#ffffff10" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-white/40 mt-1">Memória</p>
                <p className="text-sm text-white font-medium">{systemStats?.memory.percent ?? 0}%</p>
              </div>
              <div className="text-center">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={diskData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill="#eab308" />
                      <Cell fill="#ffffff10" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-white/40 mt-1">Disco</p>
                <p className="text-sm text-white font-medium">{systemStats?.disk.percent ?? 0}%</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-white/30">Load 1m</p>
                <p className="text-sm text-white font-medium">{systemStats?.load.load1.toFixed(2) ?? "0"}</p>
              </div>
              <div>
                <p className="text-xs text-white/30">Load 5m</p>
                <p className="text-sm text-white font-medium">{systemStats?.load.load5.toFixed(2) ?? "0"}</p>
              </div>
              <div>
                <p className="text-xs text-white/30">Load 15m</p>
                <p className="text-sm text-white font-medium">{systemStats?.load.load15.toFixed(2) ?? "0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Container Stats */}
      <Card className="bg-[#111] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Server className="h-4 w-4 text-white/50" />
            Containers ({containerStats.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {containerStats.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">Nenhum container em execução</p>
          ) : (
            <div className="space-y-3">
              {/* Container CPU chart */}
              {containerStats.length > 0 && (
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={containerStats.map((c) => ({
                      name: c.name.substring(0, 15),
                      cpu: c.cpu,
                      memory: c.memory.percent,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="name" tick={{ fill: "#ffffff40", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
                      <Line type="monotone" dataKey="memory" name="Mem %" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Container list */}
              {containerStats.map((container, index) => (
                <div key={container.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-medium truncate">{container.name}</p>
                      {container.health === "healthy" && (
                        <Badge variant="outline" className="text-green-400 border-green-400/30 text-[10px] h-4">
                          <Heart className="h-2.5 w-2.5 mr-0.5" /> Healthy
                        </Badge>
                      )}
                      {container.health === "unhealthy" && (
                        <Badge variant="outline" className="text-red-400 border-red-400/30 text-[10px] h-4">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Unhealthy
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-white/30 truncate">{container.image}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-white/40">CPU</span>
                      <span className="text-xs text-blue-400 font-mono w-14 text-right">{container.cpu.toFixed(1)}%</span>
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(container.cpu, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-white/40">MEM</span>
                      <span className="text-xs text-green-400 font-mono w-14 text-right">{formatBytes(container.memory.usage)}</span>
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(container.memory.percent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <ArrowDown className="h-2.5 w-2.5 text-green-400" /> {formatBytes(container.network.rxBytes)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <ArrowUp className="h-2.5 w-2.5 text-blue-400" /> {formatBytes(container.network.txBytes)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
