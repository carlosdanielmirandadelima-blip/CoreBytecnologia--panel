"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Container,
  Play,
  Square,
  RotateCw,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ContainerInfo {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: { privatePort: number; publicPort?: number; type: string }[];
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch("/api/containers");
      if (res.ok) setContainers(await res.json());
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, [fetchContainers]);

  const handleAction = async (
    id: string,
    action: string,
    name: string
  ) => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/containers/${id}/${action}`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(`Container "${name}" - ${action} executado com sucesso`);
        await fetchContainers();
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

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover o container "${name}"?`))
      return;
    setActionLoading(`${id}-remove`);
    try {
      const res = await fetch(`/api/containers/${id}?force=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Container "${name}" removido com sucesso`);
        await fetchContainers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao remover container");
      }
    } catch {
      toast.error("Erro ao remover container");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      c.state === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Containers</h2>
          <p className="text-sm text-white/50 mt-1">
            Gerencie seus containers Docker
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchContainers}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="flex gap-1">
          {["all", "running", "exited", "paused"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }
            >
              {f === "all"
                ? "Todos"
                : f === "running"
                ? "Rodando"
                : f === "exited"
                ? "Parados"
                : "Pausados"}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="py-12 text-center">
            <Container className="h-12 w-12 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">
              Nenhum container encontrado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((container) => (
            <Card
              key={container.id}
              className="bg-[#111] border-white/10 hover:border-white/20 transition-colors"
            >
              <CardHeader className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        container.state === "running"
                          ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                          : container.state === "exited"
                          ? "bg-red-400"
                          : "bg-yellow-400"
                      }`}
                    />
                    <div>
                      <CardTitle className="text-base text-white">
                        {container.name}
                      </CardTitle>
                      <p className="text-xs text-white/40 mt-0.5 font-mono">
                        {container.shortId} &middot; {container.image}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      container.state === "running"
                        ? "default"
                        : container.state === "exited"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {container.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span>{container.status}</span>
                    {container.ports
                      .filter((p) => p.publicPort)
                      .map((p, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[10px] border-white/10 text-white/50"
                        >
                          {p.publicPort}:{p.privatePort}/{p.type}
                        </Badge>
                      ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/containers/${container.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
                        title="Detalhes"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    {container.state !== "running" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-400/70 hover:text-green-400 hover:bg-green-400/10"
                        onClick={() =>
                          handleAction(container.id, "start", container.name)
                        }
                        disabled={actionLoading === `${container.id}-start`}
                        title="Iniciar"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {container.state === "running" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10"
                        onClick={() =>
                          handleAction(container.id, "stop", container.name)
                        }
                        disabled={actionLoading === `${container.id}-stop`}
                        title="Parar"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-400/70 hover:text-blue-400 hover:bg-blue-400/10"
                      onClick={() =>
                        handleAction(container.id, "restart", container.name)
                      }
                      disabled={actionLoading === `${container.id}-restart`}
                      title="Reiniciar"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400/70 hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => handleRemove(container.id, container.name)}
                      disabled={actionLoading === `${container.id}-remove`}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
