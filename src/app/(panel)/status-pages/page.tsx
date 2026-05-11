"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Globe,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface StatusCheck {
  id: string;
  status: string;
  responseTime: number;
  createdAt: string;
}

interface StatusMonitor {
  id: string;
  name: string;
  type: string;
  target: string;
  interval: number;
  timeout: number;
  status: string;
  lastResponse: number;
  uptime24h: number;
  lastCheck: string | null;
  checks: StatusCheck[];
}

interface StatusPage {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  monitors: StatusMonitor[];
  createdAt: string;
}

function statusIcon(status: string) {
  switch (status) {
    case "up": return <ArrowUp className="h-3 w-3 text-green-400" />;
    case "down": return <ArrowDown className="h-3 w-3 text-red-400" />;
    case "degraded": return <Minus className="h-3 w-3 text-yellow-400" />;
    default: return <Minus className="h-3 w-3 text-white/30" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "up": return "bg-green-500/10 text-green-400";
    case "down": return "bg-red-500/10 text-red-400";
    case "degraded": return "bg-yellow-500/10 text-yellow-400";
    default: return "bg-white/5 text-white/30";
  }
}

export default function StatusPagesPage() {
  const [pages, setPages] = useState<StatusPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<StatusPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showNewMonitor, setShowNewMonitor] = useState(false);
  const [pageName, setPageName] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageDesc, setPageDesc] = useState("");
  const [monName, setMonName] = useState("");
  const [monType, setMonType] = useState("http");
  const [monTarget, setMonTarget] = useState("");
  const [monInterval, setMonInterval] = useState(60);
  const [checking, setChecking] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status-pages");
      if (res.ok) setPages(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const fetchPage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/status-pages/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPage(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createPage = async () => {
    if (!pageName || !pageSlug) { toast.error("Preencha nome e slug"); return; }
    try {
      const res = await fetch("/api/status-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pageName, slug: pageSlug, description: pageDesc }),
      });
      if (res.ok) {
        toast.success("Status Page criada!");
        setShowNewPage(false); setPageName(""); setPageSlug(""); setPageDesc("");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro");
      }
    } catch { toast.error("Erro ao criar"); }
  };

  const deletePage = async (id: string) => {
    if (!confirm("Remover esta Status Page e todos os monitores?")) return;
    try {
      await fetch(`/api/status-pages/${id}`, { method: "DELETE" });
      toast.success("Removida"); setSelectedPage(null); fetchData();
    } catch { toast.error("Erro"); }
  };

  const addMonitor = async () => {
    if (!selectedPage || !monName || !monTarget) { toast.error("Preencha nome e target"); return; }
    try {
      const res = await fetch(`/api/status-pages/${selectedPage.id}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: monName, type: monType, target: monTarget, interval: monInterval }),
      });
      if (res.ok) {
        toast.success("Monitor adicionado!");
        setShowNewMonitor(false); setMonName(""); setMonTarget("");
        fetchPage(selectedPage.id);
      }
    } catch { toast.error("Erro"); }
  };

  const deleteMonitor = async (monitorId: string) => {
    if (!selectedPage || !confirm("Remover este monitor?")) return;
    try {
      await fetch(`/api/status-pages/${selectedPage.id}/monitors/${monitorId}`, { method: "DELETE" });
      toast.success("Monitor removido"); fetchPage(selectedPage.id);
    } catch { toast.error("Erro"); }
  };

  const runChecks = async () => {
    if (!selectedPage) return;
    setChecking(true);
    try {
      await fetch(`/api/status-pages/${selectedPage.id}/check`, { method: "POST" });
      toast.success("Verificação concluída!");
      fetchPage(selectedPage.id);
    } catch { toast.error("Erro"); }
    finally { setChecking(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Status Pages</h2>
          <p className="text-sm text-white/50 mt-1">Páginas públicas de status dos seus serviços</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowNewPage(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Status Page
          </Button>
        </div>
      </div>

      {showNewPage && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3"><CardTitle className="text-base text-white">Nova Status Page</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={pageName} onChange={(e) => { setPageName(e.target.value); setPageSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }}
                  placeholder="Meus Serviços" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Slug (URL)</label>
                <Input value={pageSlug} onChange={(e) => setPageSlug(e.target.value)}
                  placeholder="meus-servicos" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Descrição</label>
                <Input value={pageDesc} onChange={(e) => setPageDesc(e.target.value)}
                  placeholder="Status dos serviços" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createPage} className="bg-blue-600 hover:bg-blue-700 text-white">Criar</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewPage(false)} className="text-white/50 hover:text-white">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages List */}
      {pages.length === 0 && !showNewPage ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhuma Status Page criada</p>
            <p className="text-xs text-white/25 mt-1">Crie uma página de status para monitorar seus serviços</p>
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowNewPage(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar Status Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pages.map((page) => (
            <Card key={page.id} className={`bg-[#111] border-white/10 cursor-pointer hover:border-white/20 transition-all ${selectedPage?.id === page.id ? "border-blue-500/50" : ""}`}
              onClick={() => fetchPage(page.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">{page.name}</h3>
                    <p className="text-[10px] text-white/30">/status/{page.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {page.isPublic ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3 text-white/20" />}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">{page.monitors.length} monitor{page.monitors.length !== 1 ? "es" : ""}</span>
                  {page.monitors.some((m) => m.status === "down") && (
                    <Badge className="bg-red-500/10 text-red-400 border-0 text-[9px]">Incidente</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Page Detail */}
      {selectedPage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">{selectedPage.name}</h3>
              <a href={`/status/${selectedPage.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={runChecks} disabled={checking}
                className="border-white/10 text-white/50 hover:text-white text-xs">
                <RefreshCw className={`h-3 w-3 mr-1 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Verificando..." : "Verificar Agora"}
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => setShowNewMonitor(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Monitor
              </Button>
              <Button size="sm" variant="ghost" className="text-red-400/50 hover:text-red-400 text-xs"
                onClick={() => deletePage(selectedPage.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {showNewMonitor && (
            <Card className="bg-[#111] border-white/10">
              <CardHeader className="pb-3"><CardTitle className="text-base text-white">Novo Monitor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Nome</label>
                    <Input value={monName} onChange={(e) => setMonName(e.target.value)} placeholder="API Principal"
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Tipo</label>
                    <select value={monType} onChange={(e) => setMonType(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                      <option value="http">HTTP(S)</option>
                      <option value="tcp">TCP</option>
                      <option value="ping">Ping</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Target</label>
                    <Input value={monTarget} onChange={(e) => setMonTarget(e.target.value)}
                      placeholder={monType === "tcp" ? "host:port" : monType === "ping" ? "host" : "https://..."}
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Intervalo (seg)</label>
                    <Input type="number" value={monInterval} onChange={(e) => setMonInterval(parseInt(e.target.value) || 60)}
                      className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addMonitor} className="bg-blue-600 hover:bg-blue-700 text-white">Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewMonitor(false)} className="text-white/50 hover:text-white">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monitors */}
          {selectedPage.monitors.length === 0 ? (
            <Card className="bg-[#111] border-white/10 border-dashed">
              <CardContent className="py-8 text-center">
                <Globe className="h-8 w-8 text-white/10 mx-auto" />
                <p className="text-sm text-white/30 mt-2">Adicione monitores para acompanhar seus serviços</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {selectedPage.monitors.map((monitor) => (
                <Card key={monitor.id} className="bg-[#111] border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {statusIcon(monitor.status)}
                        <span className="text-sm font-medium text-white">{monitor.name}</span>
                        <Badge className={`border-0 text-[10px] ${statusColor(monitor.status)}`}>{monitor.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {monitor.lastResponse}ms
                        </span>
                        <Badge className="bg-white/5 text-white/40 border-0 text-[10px]">{monitor.uptime24h}% uptime</Badge>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-red-400/50 hover:text-red-400"
                          onClick={() => deleteMonitor(monitor.id)}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/20">
                      <span>{monitor.type.toUpperCase()}</span>
                      <span>→</span>
                      <span className="truncate">{monitor.target}</span>
                      <span>• cada {monitor.interval}s</span>
                    </div>
                    {/* Mini status bar */}
                    <div className="flex gap-0.5 mt-2">
                      {monitor.checks.slice(0, 30).reverse().map((check, i) => (
                        <div key={i} className={`h-4 flex-1 rounded-sm ${
                          check.status === "up" ? "bg-green-500/40" : check.status === "down" ? "bg-red-500/40" : "bg-yellow-500/40"
                        }`} title={`${check.status} - ${check.responseTime}ms`} />
                      ))}
                      {monitor.checks.length === 0 && Array(30).fill(0).map((_, i) => (
                        <div key={i} className="h-4 flex-1 rounded-sm bg-white/5" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
