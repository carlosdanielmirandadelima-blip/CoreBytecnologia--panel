"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowUp, ArrowDown, Minus, Clock } from "lucide-react";

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
  status: string;
  lastResponse: number;
  uptime24h: number;
  lastCheck: string | null;
  checks: StatusCheck[];
}

interface StatusPageData {
  id: string;
  name: string;
  slug: string;
  description: string;
  monitors: StatusMonitor[];
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "up": return <ArrowUp className="h-4 w-4 text-green-500" />;
    case "down": return <ArrowDown className="h-4 w-4 text-red-500" />;
    case "degraded": return <Minus className="h-4 w-4 text-yellow-500" />;
    default: return <Minus className="h-4 w-4 text-gray-400" />;
  }
}

function getOverallStatus(monitors: StatusMonitor[]): { text: string; color: string; bg: string } {
  if (monitors.length === 0) return { text: "Sem monitores", color: "text-gray-400", bg: "bg-gray-500/10" };
  if (monitors.every((m) => m.status === "up")) return { text: "Todos os sistemas operacionais", color: "text-green-400", bg: "bg-green-500/10" };
  if (monitors.some((m) => m.status === "down")) return { text: "Incidente em andamento", color: "text-red-400", bg: "bg-red-500/10" };
  return { text: "Degradação parcial", color: "text-yellow-400", bg: "bg-yellow-500/10" };
}

export default function PublicStatusPage() {
  const params = useParams();
  const [data, setData] = useState<StatusPageData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/status/${params.slug}`);
        if (res.ok) setData(await res.json());
        else setNotFound(true);
      } catch { setNotFound(true); }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [params.slug]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">404</h1>
          <p className="text-white/50 mt-2">Status page não encontrada</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const overall = getOverallStatus(data.monitors);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/assets/logo-white.png" alt="CoreByte" className="w-8 h-8 mx-auto mb-4 opacity-50" />
          <h1 className="text-2xl font-bold text-white">{data.name}</h1>
          {data.description && <p className="text-sm text-white/50 mt-2">{data.description}</p>}
        </div>

        {/* Overall Status */}
        <div className={`rounded-xl p-4 mb-8 ${overall.bg}`}>
          <p className={`text-center font-semibold ${overall.color}`}>{overall.text}</p>
        </div>

        {/* Monitors */}
        <div className="space-y-3">
          {data.monitors.map((monitor) => (
            <div key={monitor.id} className="bg-[#111] rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon status={monitor.status} />
                  <span className="text-sm font-medium text-white">{monitor.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {monitor.lastResponse}ms
                  </span>
                  <span className={`text-xs font-medium ${monitor.uptime24h >= 99 ? "text-green-400" : monitor.uptime24h >= 95 ? "text-yellow-400" : "text-red-400"}`}>
                    {monitor.uptime24h}%
                  </span>
                </div>
              </div>
              {/* Status bar */}
              <div className="flex gap-0.5">
                {monitor.checks.slice(0, 30).reverse().map((check, i) => (
                  <div key={i} className={`h-6 flex-1 rounded-sm transition-colors ${
                    check.status === "up" ? "bg-green-500/50 hover:bg-green-500/70" : check.status === "down" ? "bg-red-500/50 hover:bg-red-500/70" : "bg-yellow-500/50 hover:bg-yellow-500/70"
                  }`} title={`${new Date(check.createdAt).toLocaleString("pt-BR")} — ${check.status} (${check.responseTime}ms)`} />
                ))}
                {monitor.checks.length < 30 && Array(30 - monitor.checks.length).fill(0).map((_, i) => (
                  <div key={`empty-${i}`} className="h-6 flex-1 rounded-sm bg-white/5" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 flex items-center justify-center gap-2 text-white/20">
          <img src="/assets/logo-white.png" alt="CoreByte" className="w-3 h-3 opacity-30" />
          <span className="text-[10px]">Powered by CoreByte Panel</span>
        </div>
      </div>
    </div>
  );
}
