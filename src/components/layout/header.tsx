"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  "/api-keys": "API Keys",
  "/plugins": "Plugins",
  "/teams": "Times",
  "/settings": "Configurações",
};

export default function Header() {
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname.startsWith("/containers/")) return "Detalhes do Container";
    if (pathname.startsWith("/projects/") && pathname !== "/projects/new") return "Detalhes do Projeto";
    if (pathname === "/projects/new") return "Novo Projeto";
    if (pathname.startsWith("/teams/")) return "Detalhes do Time";
    return pageTitles[pathname] || "CoreByte Panel";
  };

  return (
    <header className="h-14 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-white">{getTitle()}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar..."
            className="w-64 pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
