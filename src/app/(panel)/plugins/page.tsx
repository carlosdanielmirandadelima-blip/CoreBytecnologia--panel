"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Puzzle,
  RefreshCw,
  Shield,
  FileText,
  Bell,
  Cpu,
  Clock,
  Lock,
  Mail,
  Zap,
  Power,
} from "lucide-react";
import { toast } from "sonner";

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  icon: string;
  enabled: boolean;
  createdAt: string;
}

function getPluginIcon(icon: string) {
  const cls = "h-5 w-5";
  switch (icon) {
    case "shield": return <Shield className={cls} />;
    case "file-text": return <FileText className={cls} />;
    case "refresh-cw": return <RefreshCw className={cls} />;
    case "bell": return <Bell className={cls} />;
    case "cpu": return <Cpu className={cls} />;
    case "clock": return <Clock className={cls} />;
    case "lock": return <Lock className={cls} />;
    case "mail": return <Mail className={cls} />;
    default: return <Puzzle className={cls} />;
  }
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/plugins");
      if (res.ok) setPlugins(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePlugin = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/plugins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      toast.success(enabled ? "Plugin desativado" : "Plugin ativado!");
      fetchData();
    } catch { toast.error("Erro"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  const activeCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Plugins</h2>
          <p className="text-sm text-white/50 mt-1">Estenda as funcionalidades do painel • {activeCount} ativo{activeCount !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((plugin) => (
          <Card key={plugin.id} className={`bg-[#111] border-white/10 ${plugin.enabled ? "border-blue-500/30" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${plugin.enabled ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/20"}`}>
                    {getPluginIcon(plugin.icon)}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{plugin.displayName}</h3>
                    <span className="text-[10px] text-white/30">v{plugin.version}</span>
                  </div>
                </div>
                <Badge className={`border-0 text-[10px] ${plugin.enabled ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                  {plugin.enabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-xs text-white/40 mb-4 line-clamp-2">{plugin.description}</p>
              <Button
                size="sm"
                variant={plugin.enabled ? "outline" : "default"}
                className={`w-full text-xs ${plugin.enabled ? "border-white/10 text-white/50 hover:text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                onClick={() => togglePlugin(plugin.id, plugin.enabled)}
              >
                {plugin.enabled ? (
                  <><Power className="h-3 w-3 mr-1" /> Desativar</>
                ) : (
                  <><Zap className="h-3 w-3 mr-1" /> Ativar</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
