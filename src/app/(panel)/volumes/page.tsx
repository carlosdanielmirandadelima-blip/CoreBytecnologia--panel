"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, HardDrive, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  createdAt: string;
}

export default function VolumesPage() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchVolumes = useCallback(async () => {
    try {
      const res = await fetch("/api/volumes");
      const data = await res.json();
      setVolumes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar volumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVolumes(); }, [fetchVolumes]);

  const handleCreate = async () => {
    if (!newName) { toast.error("Nome é obrigatório"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        toast.success("Volume criado!");
        setNewName("");
        setShowCreate(false);
        fetchVolumes();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao criar volume");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remover volume "${name}"? Dados serão perdidos permanentemente.`)) return;
    try {
      const res = await fetch(`/api/volumes?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Volume removido");
        fetchVolumes();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const filtered = volumes.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Volumes</h1>
          <p className="text-sm text-white/50">Gerencie volumes Docker para persistência de dados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVolumes} className="border-white/10 text-white/70">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Volume
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                className="bg-white/5 border-white/10 text-white" placeholder="Nome do volume (ex: postgres_data)" />
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Criar
              </Button>
              <Button size="sm" variant="ghost" className="text-white/50 shrink-0" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input placeholder="Buscar volumes..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/50">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="py-12 text-center">
            <HardDrive className="h-12 w-12 text-white/10 mx-auto" />
            <p className="text-white/40 mt-4">Nenhum volume encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((volume) => (
            <Card key={volume.name} className="bg-[#111] border-white/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{volume.name}</p>
                    <p className="text-xs text-white/30 font-mono">{volume.mountpoint}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-white/40 border-white/10 text-xs">{volume.driver}</Badge>
                  <Badge variant="outline" className="text-white/40 border-white/10 text-xs">{volume.scope}</Badge>
                  {volume.createdAt && (
                    <span className="text-xs text-white/30">{new Date(volume.createdAt).toLocaleDateString("pt-BR")}</span>
                  )}
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 h-7 w-7"
                    onClick={() => handleDelete(volume.name)}>
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
