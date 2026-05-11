"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  ShieldOff,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Zone {
  id: string;
  name: string;
  status: string;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

export default function DnsPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState("A");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newProxied, setNewProxied] = useState(true);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch("/api/dns/zones");
      if (res.ok) {
        const data = await res.json();
        setZones(data);
        setError("");
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao carregar zonas");
      }
    } catch {
      setError("Erro de conexão");
    } finally { setLoading(false); }
  }, []);

  const fetchRecords = useCallback(async (zoneId: string) => {
    try {
      const res = await fetch(`/api/dns?zoneId=${zoneId}`);
      if (res.ok) setRecords(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  useEffect(() => { if (selectedZone) fetchRecords(selectedZone.id); }, [selectedZone, fetchRecords]);

  const selectZone = (zone: Zone) => {
    setSelectedZone(zone);
    setRecords([]);
  };

  const createRecord = async () => {
    if (!selectedZone || !newName || !newContent) { toast.error("Preencha todos os campos"); return; }
    try {
      const res = await fetch("/api/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: selectedZone.id,
          zoneName: selectedZone.name,
          type: newType,
          name: newName,
          content: newContent,
          proxied: newProxied,
        }),
      });
      if (res.ok) {
        toast.success("Registro criado!");
        setShowNew(false); setNewName(""); setNewContent("");
        fetchRecords(selectedZone.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro");
      }
    } catch { toast.error("Erro ao criar"); }
  };

  const deleteRecord = async (recordId: string) => {
    if (!selectedZone || !confirm("Remover este registro DNS?")) return;
    try {
      await fetch(`/api/dns/${recordId}?zoneId=${selectedZone.id}`, { method: "DELETE" });
      toast.success("Registro removido");
      fetchRecords(selectedZone.id);
    } catch { toast.error("Erro ao remover"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">DNS Cloudflare</h2>
          <p className="text-sm text-white/50 mt-1">Gerencie registros DNS via Cloudflare</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchZones} className="border-white/10 text-white/50 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm text-yellow-400">{error}</p>
              <p className="text-xs text-white/30 mt-0.5">Configure o token em Configurações → aba Integrações (será adicionada)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone selector */}
      {zones.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {zones.map((zone) => (
            <button key={zone.id} onClick={() => selectZone(zone)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedZone?.id === zone.id ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
              }`}>
              <Globe className="h-3.5 w-3.5 inline mr-1.5" />
              {zone.name}
            </button>
          ))}
        </div>
      )}

      {/* DNS Records */}
      {selectedZone && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{selectedZone.name} — Registros DNS</h3>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Registro
            </Button>
          </div>

          {showNew && (
            <Card className="bg-[#111] border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Novo Registro DNS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Tipo</label>
                    <select value={newType} onChange={(e) => setNewType(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="NS">NS</option>
                      <option value="SRV">SRV</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Nome</label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="@"
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Conteúdo</label>
                    <Input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="192.168.1.1"
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Proxy</label>
                    <select value={newProxied ? "true" : "false"} onChange={(e) => setNewProxied(e.target.value === "true")}
                      className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                      <option value="true">Proxied (CDN)</option>
                      <option value="false">DNS Only</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={createRecord} className="bg-blue-600 hover:bg-blue-700 text-white">Criar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="text-white/50 hover:text-white">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-1">
            {records.map((record) => (
              <Card key={record.id} className="bg-[#111] border-white/10">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className="bg-white/5 text-white/60 border-0 text-[10px] font-mono min-w-[50px] justify-center">{record.type}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{record.name}</p>
                      <p className="text-xs text-white/30 truncate">{record.content}</p>
                    </div>
                    {record.proxied ? (
                      <Shield className="h-3.5 w-3.5 text-orange-400" title="Proxied" />
                    ) : (
                      <ShieldOff className="h-3.5 w-3.5 text-white/20" title="DNS only" />
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                    onClick={() => deleteRecord(record.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {records.length === 0 && (
              <div className="text-center py-8">
                <Globe className="h-8 w-8 text-white/10 mx-auto" />
                <p className="text-sm text-white/30 mt-2">Nenhum registro encontrado</p>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedZone && zones.length > 0 && (
        <div className="text-center py-8">
          <Globe className="h-8 w-8 text-white/10 mx-auto" />
          <p className="text-sm text-white/30 mt-2">Selecione uma zona acima para gerenciar DNS</p>
        </div>
      )}
    </div>
  );
}
