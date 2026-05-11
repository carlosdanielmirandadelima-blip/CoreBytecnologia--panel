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
  Loader2,
  Power,
  Zap,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

interface DdnsRecord {
  id: string;
  hostname: string;
  type: string;
  currentIp: string;
  lastIp: string;
  provider: string;
  zoneId: string;
  recordId: string;
  interval: number;
  enabled: boolean;
  lastUpdate: string | null;
  lastCheck: string | null;
  createdAt: string;
}

export default function DynamicDnsPage() {
  const [records, setRecords] = useState<DdnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hostname, setHostname] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [token, setToken] = useState("");
  const [interval, setInterval_] = useState(300);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dynamic-dns");
      if (res.ok) setRecords(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createRecord = async () => {
    if (!hostname) { toast.error("Hostname é obrigatório"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/dynamic-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname, zoneId, recordId, token, interval: interval_ }),
      });
      if (res.ok) {
        toast.success("Registro DDNS criado!");
        setShowForm(false); setHostname("");
        fetchData();
      }
    } catch { toast.error("Erro"); }
    finally { setCreating(false); }
  };

  const checkNow = async (id: string) => {
    setChecking(id);
    try {
      const res = await fetch(`/api/dynamic-dns/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.ip) toast.success(`IP: ${data.ip} - ${data.status}`);
      else toast.error(data.error || "Erro");
      fetchData();
    } catch { toast.error("Erro"); }
    finally { setChecking(null); }
  };

  const toggleRecord = async (id: string, enabled: boolean) => {
    await fetch(`/api/dynamic-dns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    toast.success(enabled ? "Desativado" : "Ativado");
    fetchData();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await fetch(`/api/dynamic-dns/${id}`, { method: "DELETE" });
    toast.success("Removido");
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">DNS Dinâmico</h2>
          <p className="text-sm text-white/50 mt-1">Atualização automática de registros DNS com seu IP</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Registro
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Registro DNS Dinâmico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Hostname</label>
                <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="meusite.example.com"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Intervalo (segundos)</label>
                <Input type="number" value={interval_} onChange={(e) => setInterval_(Number(e.target.value))} placeholder="300"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Zone ID (Cloudflare)</label>
                <Input value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="Opcional"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Record ID (Cloudflare)</label>
                <Input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Opcional"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Token API</label>
                <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Opcional"
                  className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createRecord} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />} Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-white/50">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Globe className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum registro DDNS configurado</p>
            <p className="text-xs text-white/25 mt-1">Configure DNS dinâmico para manter seus domínios atualizados</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id} className={`bg-[#111] border-white/10 ${r.enabled ? "border-green-500/20" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${r.enabled ? "bg-green-500/10" : "bg-white/5"}`}>
                      <Wifi className={`h-4 w-4 ${r.enabled ? "text-green-400" : "text-white/30"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{r.hostname}</span>
                        <Badge className={`border-0 text-[10px] ${r.enabled ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                          {r.enabled ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge className="border-0 text-[10px] bg-white/5 text-white/30">{r.type}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                        <span>IP: {r.currentIp || "não detectado"}</span>
                        {r.lastIp && r.lastIp !== r.currentIp && <span>Anterior: {r.lastIp}</span>}
                        <span>Intervalo: {r.interval}s</span>
                        {r.lastCheck && <span>Check: {new Date(r.lastCheck).toLocaleString("pt-BR")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400/50 hover:text-blue-400"
                      onClick={() => checkNow(r.id)} disabled={checking === r.id}>
                      {checking === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-white/30 hover:text-white"
                      onClick={() => toggleRecord(r.id, r.enabled)}>
                      {r.enabled ? <Power className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                      onClick={() => deleteRecord(r.id)}>
                      <Trash2 className="h-3 w-3" />
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
