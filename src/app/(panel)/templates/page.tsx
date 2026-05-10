"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  RefreshCw,
  Loader2,
  Search,
  Rocket,
  Download,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  image: string;
  ports: string;
  envVars: string;
  volumes: string;
  featured: boolean;
  downloads: number;
}

const categories = [
  { key: "all", label: "Todos" },
  { key: "web", label: "Web" },
  { key: "database", label: "Banco de Dados" },
  { key: "cache", label: "Cache" },
  { key: "cms", label: "CMS" },
  { key: "monitoring", label: "Monitoramento" },
  { key: "devops", label: "DevOps" },
  { key: "storage", label: "Armazenamento" },
  { key: "automation", label: "Automação" },
  { key: "communication", label: "Comunicação" },
  { key: "messaging", label: "Mensageria" },
  { key: "security", label: "Segurança" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [deploying, setDeploying] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deployTemplate = async (t: TemplateData) => {
    setDeploying(t.id);
    try {
      let ports: string[] = [];
      let envVars: { key: string; value: string }[] = [];
      let volumes: string[] = [];
      try { ports = JSON.parse(t.ports); } catch { /* silent */ }
      try { envVars = JSON.parse(t.envVars); } catch { /* silent */ }
      try { volumes = JSON.parse(t.volumes); } catch { /* silent */ }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          type: "custom",
          image: t.image,
          ports: ports.map(p => {
            const [host, container] = p.split(":");
            return { host, container };
          }),
          envVars: envVars.map(e => ({ key: e.key, value: e.value })),
          volumes: volumes.map(v => ({ source: v.split(":")[0], target: v.split(":")[1] || v.split(":")[0] })),
        }),
      });

      if (res.ok) {
        await fetch(`/api/templates/${t.id}`, { method: "PATCH" });
        toast.success(`${t.name} deployed com sucesso!`);
        fetchData();
      } else {
        toast.error("Erro ao fazer deploy");
      }
    } catch { toast.error("Erro"); }
    finally { setDeploying(null); }
  };

  const filtered = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || t.category === category;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Marketplace</h2>
          <p className="text-sm text-white/50 mt-1">Templates prontos para deploy com um clique</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-white/10 text-white/50 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar templates..."
            className="bg-white/5 border-white/10 text-white h-9 text-sm pl-9" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <Button key={c.key} variant="ghost" size="sm"
            className={`text-xs h-7 ${category === c.key ? "bg-blue-600 text-white" : "text-white/40 hover:text-white"}`}
            onClick={() => setCategory(c.key)}>
            {c.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-[#111] border-white/10 border-dashed">
          <CardContent className="py-12 text-center">
            <Store className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">Nenhum template encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="bg-[#111] border-white/10 hover:border-white/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white">{t.name}</span>
                        {t.featured && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
                      </div>
                      <Badge className="border-0 text-[10px] bg-white/5 text-white/30 mt-0.5">{t.category}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/20">
                    <Download className="h-2.5 w-2.5" /> {t.downloads}
                  </div>
                </div>
                <p className="text-xs text-white/40 mb-3 line-clamp-2">{t.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/20 font-mono">{t.image}</span>
                  <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => deployTemplate(t)} disabled={deploying === t.id}>
                    {deploying === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                    Deploy
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
