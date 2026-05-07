"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Container,
  ImageIcon,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  FolderOpen,
  FileCode,
  Users,
  HardDrive,
  Activity,
  Archive,
  Server,
  Globe,
  RadioTower,
  Key,
  Puzzle,
  Network,
  Scaling,
  GitBranch,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projetos", icon: FolderOpen },
  { href: "/compose", label: "Editor Compose", icon: FileCode },
  { href: "/containers", label: "Containers", icon: Container },
  { href: "/images", label: "Imagens", icon: ImageIcon },
  { href: "/monitoring", label: "Monitoramento", icon: Activity },
  { href: "/volumes", label: "Volumes", icon: HardDrive },
  { href: "/backups", label: "Backups", icon: Archive },
  { href: "/servers", label: "Servidores", icon: Server },
  { href: "/dns", label: "DNS", icon: Globe },
  { href: "/status-pages", label: "Status Pages", icon: RadioTower },
  { href: "/clusters", label: "Clusters", icon: Network },
  { href: "/scaling", label: "Auto Scaling", icon: Scaling },
  { href: "/pipelines", label: "CI/CD", icon: GitBranch },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/plugins", label: "Plugins", icon: Puzzle },
  { href: "/teams", label: "Times", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[#0a0a0a] border-r border-white/10 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <img
          src="/assets/logo-white.png"
          alt="CoreByte"
          className="min-w-[32px] w-8 h-8"
        />
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-white truncate">
              CoreByte
            </span>
            <span className="text-[10px] text-white/50">Tecnologia</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "ml-auto h-7 w-7 text-white/50 hover:text-white hover:bg-white/10",
            collapsed && "ml-0"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="h-5 w-5 min-w-[20px]" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 min-w-[32px]">
            <User className="h-4 w-4 text-white/70" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {session?.user?.name || "Usuário"}
              </p>
              <p className="text-[10px] text-white/50 truncate">
                {session?.user?.email}
              </p>
            </div>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/50 hover:text-red-400 hover:bg-white/10"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        className={cn(
          "px-3 py-2 border-t border-white/5 text-center",
          collapsed && "px-1"
        )}
      >
        <p className="text-[9px] text-white/30">
          {collapsed ? "CB" : "CoreByte Tecnologia"}
        </p>
      </div>
    </aside>
  );
}
