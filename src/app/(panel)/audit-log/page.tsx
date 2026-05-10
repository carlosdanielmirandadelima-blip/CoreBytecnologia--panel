"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  RefreshCw,
  Search,
  User,
  Clock,
  Shield,
  Settings,
  Trash2,
  Plus,
  Edit,
  Power,
  Globe,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  userId: string;
  userName: string;
  ipAddress: string;
  createdAt: string;
}

function actionIcon(action: string) {
  const cls = "h-3.5 w-3.5";
  switch (action) {
    case "create": return <Plus className={`${cls} text-green-400`} />;
    case "update": return <Edit className={`${cls} text-blue-400`} />;
    case "delete": return <Trash2 className={`${cls} text-red-400`} />;
    case "login": return <User className={`${cls} text-purple-400`} />;
    case "start": case "deploy": return <Power className={`${cls} text-green-400`} />;
    case "stop": return <Power className={`${cls} text-orange-400`} />;
    case "settings": return <Settings className={`${cls} text-white/40`} />;
    case "security": return <Shield className={`${cls} text-yellow-400`} />;
    default: return <Globe className={`${cls} text-white/30`} />;
  }
}

function actionColor(action: string) {
  switch (action) {
    case "create": case "start": case "deploy": return "bg-green-500/10 text-green-400";
    case "update": return "bg-blue-500/10 text-blue-400";
    case "delete": case "stop": return "bg-red-500/10 text-red-400";
    case "login": return "bg-purple-500/10 text-purple-400";
    case "security": return "bg-yellow-500/10 text-yellow-400";
    default: return "bg-white/5 text-white/30";
  }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit-log?page=${page}&limit=${perPage}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : data.entries || []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = entries.filter(e =>
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.resource.toLowerCase().includes(search.toLowerCase()) ||
    e.userName.toLowerCase().includes(search.toLowerCase()) ||
    e.details.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Audit Log</h2>
          <p className="text-sm text-white/50 mt-1">Histórico completo de ações no sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ação, recurso, usuário..."
          className="bg-white/5 border-white/10 text-white h-9 text-sm pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <ScrollText className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum registro encontrado</p>
            <p className="text-xs text-white/25 mt-1">As ações realizadas no sistema aparecerão aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
              <div className="p-1.5 bg-white/5 rounded">
                {actionIcon(e.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={`border-0 text-[10px] ${actionColor(e.action)}`}>{e.action}</Badge>
                  <span className="text-xs text-white/60">{e.resource}</span>
                  {e.details && <span className="text-xs text-white/30 truncate">{e.details}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/20 flex-shrink-0">
                {e.userName && (
                  <span className="flex items-center gap-1">
                    <User className="h-2.5 w-2.5" /> {e.userName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> {new Date(e.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="border-white/10 text-white/50 text-xs">Anterior</Button>
        <span className="text-xs text-white/30 self-center">Página {page}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={entries.length < perPage}
          className="border-white/10 text-white/50 text-xs">Próxima</Button>
      </div>
    </div>
  );
}
