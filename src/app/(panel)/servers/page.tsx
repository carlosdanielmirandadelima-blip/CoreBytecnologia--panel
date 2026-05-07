"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Container,
  Wifi,
  WifiOff,
  MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";

interface Node {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  status: string;
  isLocal: boolean;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  containers: number;
  lastCheck: string | null;
  createdAt: string;
}

function getProgressColor(p: number): string {
  if (p >= 90) return "bg-red-500";
  if (p >= 70) return "bg-yellow-500";
  return "bg-blue-500";
}

export default function ServersPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(2375);
  const [protocol, setProtocol] = useState("http");
  const [isLocal, setIsLocal] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/nodes");
      if (res.ok) setNodes(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  const addNode = async () => {
    if (!name || !host) { toast.error("Preencha nome e host"); return; }
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, host, port, protocol, isLocal }),
      });
      if (res.ok) {
        toast.success("Servidor adicionado!");
        setShowNew(false); setName(""); setHost(""); setPort(2375); setIsLocal(false);
        fetchData();
      }
    } catch { toast.error("Erro ao adicionar"); }
  };

  const checkNode = async (id: string) => {
    setChecking(id);
    try {
      await fetch(`/api/nodes/${id}/check`, { method: "POST" });
      fetchData();
      toast.success("Verificação concluída");
    } catch { toast.error("Erro na verificação"); }
    finally { setChecking(null); }
  };

  const deleteNode = async (id: string) => {
    if (!confirm("Remover este servidor?")) return;
    try {
      await fetch(`/api/nodes/${id}`, { method: "DELETE" });
      toast.success("Servidor removido"); fetchData();
    } catch { toast.error("Erro ao remover"); }
  };

  const addLocalNode = async () => {
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Local", host: "localhost", port: 2375, isLocal: true }),
      });
      if (res.ok) {
        const node = await res.json();
        await fetch(`/api/nodes/${node.id}/check`, { method: "POST" });
        toast.success("Servidor local adicionado!"); fetchData();
      }
    } catch { toast.error("Erro"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Servidores</h2>
          <p className="text-sm text-white/50 mt-1">Gerencie seus servidores Docker</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Servidor
          </Button>
        </div>
      </div>

      {showNew && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Servidor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={isLocal} onChange={(e) => setIsLocal(e.target.checked)}
                  className="rounded border-white/20" />
                Servidor Local (Docker Socket)
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="meu-server"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              {!isLocal && (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Host</label>
                    <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.100"
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Porta</label>
                    <Input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Protocolo</label>
                    <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS (TLS)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={isLocal ? addLocalNode : addNode} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Server className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="text-white/50 hover:text-white">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {nodes.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <MonitorSmartphone className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum servidor adicionado</p>
            <p className="text-xs text-white/25 mt-1">Adicione servidores Docker para gerenciá-los remotamente</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={addLocalNode}>
                <Server className="h-3.5 w-3.5 mr-1" /> Adicionar Local
              </Button>
              <Button size="sm" variant="outline" className="border-white/10 text-white/50 text-xs" onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Remoto
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node) => (
            <Card key={node.id} className="bg-[#111] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${node.status === "online" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {node.status === "online" ? <Wifi className="h-4 w-4 text-green-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{node.name}</h3>
                      <p className="text-[10px] text-white/30">
                        {node.isLocal ? "Docker Socket Local" : `${node.protocol}://${node.host}:${node.port}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={`border-0 text-[10px] ${node.status === "online" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                      {node.status}
                    </Badge>
                  </div>
                </div>

                {node.status === "online" && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3 w-3 text-blue-400" />
                      <span className="text-[10px] text-white/40 w-10">CPU</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(node.cpuPercent)}`} style={{ width: `${node.cpuPercent}%` }} />
                      </div>
                      <span className="text-[10px] text-white/50 w-10 text-right">{node.cpuPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-3 w-3 text-green-400" />
                      <span className="text-[10px] text-white/40 w-10">RAM</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(node.memoryPercent)}`} style={{ width: `${node.memoryPercent}%` }} />
                      </div>
                      <span className="text-[10px] text-white/50 w-10 text-right">{node.memoryPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] text-white/40 w-10">Disco</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(node.diskPercent)}`} style={{ width: `${node.diskPercent}%` }} />
                      </div>
                      <span className="text-[10px] text-white/50 w-10 text-right">{node.diskPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Container className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] text-white/40">{node.containers} containers</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 pt-2 border-t border-white/5">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300"
                    onClick={() => checkNode(node.id)} disabled={checking === node.id}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${checking === node.id ? "animate-spin" : ""}`} />
                    {checking === node.id ? "Verificando..." : "Verificar"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400 ml-auto"
                    onClick={() => deleteNode(node.id)}>
                    <Trash2 className="h-3 w-3" />
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
