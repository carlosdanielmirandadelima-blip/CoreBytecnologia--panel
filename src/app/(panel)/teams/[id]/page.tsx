"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Trash2, Crown, Shield, Users, Eye, Save, Loader2,
} from "lucide-react";
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
}

const roleLabels: Record<string, string> = {
  owner: "Dono", admin: "Admin", member: "Membro", viewer: "Visualizador",
};
const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5" />, admin: <Shield className="h-3.5 w-3.5" />,
  member: <Users className="h-3.5 w-3.5" />, viewer: <Eye className="h-3.5 w-3.5" />,
};
const roleColors: Record<string, string> = {
  owner: "text-yellow-400", admin: "text-blue-400", member: "text-green-400", viewer: "text-gray-400",
};

export default function TeamDetailPage() {
  const params = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${params.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setTeam(data);
      if (!editName) { setEditName(data.name); setEditDesc(data.description); }
    } catch { toast.error("Erro ao carregar time"); }
    finally { setLoading(false); }
  }, [params.id, editName]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Email é obrigatório"); return; }
    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) { toast.success("Membro adicionado!"); setInviteEmail(""); fetchTeam(); }
      else toast.error(data.error);
    } catch { toast.error("Erro ao convidar"); }
    finally { setInviting(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remover este membro?")) return;
    try {
      await fetch(`/api/teams/${params.id}/members?memberId=${memberId}`, { method: "DELETE" });
      toast.success("Membro removido"); fetchTeam();
    } catch { toast.error("Erro ao remover"); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      if (res.ok) { toast.success("Time atualizado!"); fetchTeam(); }
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 text-center text-white/50">Carregando...</div>;
  if (!team) return <div className="p-6 text-center text-white/50">Time não encontrado</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/teams"><Button variant="ghost" size="sm" className="text-white/50"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <p className="text-sm text-white/50">{team.members.length} membro(s)</p>
        </div>
      </div>

      <Card className="bg-[#111] border-white/10">
        <CardHeader><CardTitle className="text-white text-base">Informações do Time</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-white/60 text-xs">Nome</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-white/60 text-xs">Descrição</Label>
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white" placeholder="Email do usuário" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 text-white text-sm">
              <option value="admin">Admin</option>
              <option value="member">Membro</option>
              <option value="viewer">Visualizador</option>
            </select>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {team.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm text-blue-400 font-medium">
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{member.user.name}</p>
                    <p className="text-xs text-white/40">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`border-white/10 ${roleColors[member.role]}`}>
                    {roleIcons[member.role]} <span className="ml-1">{roleLabels[member.role]}</span>
                  </Badge>
                  {member.role !== "owner" && (
                    <Button variant="ghost" size="icon" className="text-red-400 h-7 w-7" onClick={() => handleRemoveMember(member.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
