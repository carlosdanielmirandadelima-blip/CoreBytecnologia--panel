"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import NotificationBell from "@/components/notifications/notification-bell";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projetos",
  "/compose": "Editor Compose",
  "/containers": "Containers",
  "/images": "Imagens",
  "/monitoring": "Monitoramento",
  "/volumes": "Volumes",
  "/backups": "Backups",
  "/servers": "Servidores",
  "/dns": "DNS Cloudflare",
  "/status-pages": "Status Pages",
  "/clusters": "Clusters K3s",
  "/scaling": "Auto Scaling",
  "/pipelines": "CI/CD Pipelines",
  "/dynamic-dns": "DNS Dinâmico",
  "/builds": "Build Server",
  "/migrations": "Migration Wizard",
  "/templates": "Marketplace",
  "/audit-log": "Audit Log",
  "/api-keys": "API Keys",
  "/plugins": "Plugins",
  "/teams": "Times",
  "/settings": "Configurações",
};

const searchablePages = Object.entries(pageTitles).map(([href, label]) => ({ href, label }));

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const getTitle = () => {
    if (pathname.startsWith("/containers/")) return "Detalhes do Container";
    if (pathname.startsWith("/projects/") && pathname !== "/projects/new") return "Detalhes do Projeto";
    if (pathname === "/projects/new") return "Novo Projeto";
    if (pathname.startsWith("/teams/")) return "Detalhes do Time";
    return pageTitles[pathname] || "CoreByte Panel";
  };

  const filteredPages = query.trim()
    ? searchablePages.filter((p) =>
        p.label.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (href: string) => {
    router.push(href);
    setQuery("");
    setShowResults(false);
  };

  return (
    <header className="h-14 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-white">{getTitle()}</h1>
      <div className="flex items-center gap-3">
        <div className="relative" ref={wrapperRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar..."
            className="w-64 pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => { if (query.trim()) setShowResults(true); }}
          />
          {showResults && query.trim() && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {filteredPages.length > 0 ? (
                filteredPages.map((page) => (
                  <button
                    key={page.href}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => handleSelect(page.href)}
                  >
                    {page.label}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-white/40">
                  Nenhum resultado encontrado
                </div>
              )}
            </div>
          )}
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
