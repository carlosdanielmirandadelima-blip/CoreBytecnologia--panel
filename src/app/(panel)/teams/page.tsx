"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Users, Trash2, Crown, Shield, Eye } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  role: string;
  user: { id: string; name: string; email: string; role: string };
}

interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  createdAt: string;
}

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <Users className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

const roleLabels: Record<string, string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar times");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleCreate = async () => {
    if (!newName) { toast.error("Nome é obrigatório"); return; }
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        toast.success("Time criado!");
        setShowCreate(false);
        setNewName("");
        setNewDesc("");
        fetchTeams();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao criar time");
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm("Remover este time?")) return;
    try {
      await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      toast.success("Time removido");
      fetchTeams();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Times</h1>
          <p className="text-sm text-white/50">Gerencie seus times e permissões</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTeams} className="border-white/10 text-white/70">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Time
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-4 space-y-3">
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Nome do time"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Descrição (opcional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate}>Criar Time</Button>
              <Button size="sm" variant="ghost" className="text-white/50" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/50">Carregando...</div>
      ) : teams.length === 0 ? (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-white/10 mx-auto" />
            <p className="text-white/40 mt-4">Nenhum time encontrado</p>
            <p className="text-white/30 text-sm mt-1">Crie um time para organizar seus projetos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="bg-[#111] border-white/10 hover:border-white/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link href={`/teams/${team.id}`} className="text-white font-medium hover:text-blue-400">
                      {team.name}
                    </Link>
                    {team.description && <p className="text-sm text-white/40 mt-0.5">{team.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-7" onClick={() => handleDelete(team.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1">
                      <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-medium">
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-white/70">{member.user.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-white/10 text-white/40">
                        {roleIcons[member.role]} {roleLabels[member.role] || member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Link href={`/teams/${team.id}`}>
                    <Button variant="ghost" size="sm" className="text-white/40 hover:text-white h-7 text-xs">
                      Gerenciar membros →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
