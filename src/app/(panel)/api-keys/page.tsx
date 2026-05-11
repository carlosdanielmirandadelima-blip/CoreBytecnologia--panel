"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface ApiKeyData {
  id: string;
  name: string;
  prefix: string;
  permissions: string;
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState("read");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) setKeys(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createKey = async () => {
    if (!name) { toast.error("Nome é obrigatório"); return; }
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions, expiresInDays: expiresInDays || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.fullKey);
        setShowNew(false);
        setName("");
        toast.success("API Key criada! Copie-a agora, ela não será mostrada novamente.");
        fetchData();
      }
    } catch { toast.error("Erro ao criar"); }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Revogar esta API Key? Esta ação não pode ser desfeita.")) return;
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      toast.success("API Key revogada"); fetchData();
    } catch { toast.error("Erro"); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copiado para a área de transferência!");
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">API Keys</h2>
          <p className="text-sm text-white/50 mt-1">Gerencie tokens de acesso à API pública</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova API Key
          </Button>
        </div>
      </div>

      {/* API Documentation card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-blue-400 mb-2">API REST v1</h3>
          <p className="text-xs text-white/40 mb-2">Use suas API keys para acessar dados via REST. Envie o token no header Authorization.</p>
          <div className="space-y-1 text-[10px] font-mono text-white/30">
            <p>GET /api/v1/system — Info do sistema</p>
            <p>GET /api/v1/projects — Lista de projetos</p>
            <p>GET /api/v1/containers — Lista de containers</p>
          </div>
          <div className="mt-2 p-2 bg-black/30 rounded text-xs font-mono text-white/50">
            curl -H &quot;Authorization: Bearer cb_xxx...&quot; /api/v1/system
          </div>
        </CardContent>
      </Card>

      {/* New key revealed */}
      {newKey && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-400">Nova API Key Criada</h3>
              <Button size="sm" variant="ghost" className="text-white/30 text-xs" onClick={() => setNewKey("")}>Fechar</Button>
            </div>
            <p className="text-xs text-white/40 mb-2">Copie agora! Esta chave não será mostrada novamente.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-black/30 rounded text-xs font-mono text-green-400 overflow-hidden">
                {showKey ? newKey : "•".repeat(40)}
              </code>
              <Button variant="ghost" size="sm" className="text-white/40" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-white/40" onClick={() => copyKey(newKey)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showNew && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Nova API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha integração"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Permissões</label>
                <select value={permissions} onChange={(e) => setPermissions(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="read">Somente Leitura</option>
                  <option value="read-write">Leitura e Escrita</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Expira em (dias, 0 = nunca)</label>
                <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 0)}
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createKey} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Key className="h-3.5 w-3.5 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="text-white/50 hover:text-white">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Key className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhuma API Key criada</p>
            <p className="text-xs text-white/25 mt-1">Crie uma chave para acessar a API REST</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <Card key={k.id} className="bg-[#111] border-white/10">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Key className="h-4 w-4 text-white/20 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{k.name}</span>
                      <Badge className={`border-0 text-[10px] ${k.permissions === "admin" ? "bg-red-500/10 text-red-400" : k.permissions === "read-write" ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`}>
                        {k.permissions}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                      <code className="font-mono">{k.prefix}</code>
                      <span>Criada {formatDate(k.createdAt)}</span>
                      {k.lastUsed && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Último uso {formatDate(k.lastUsed)}</span>}
                      {k.expiresAt && <span className="flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" /> Expira {formatDate(k.expiresAt)}</span>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                  onClick={() => deleteKey(k.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
