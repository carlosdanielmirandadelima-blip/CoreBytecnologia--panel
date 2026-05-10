"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";

const shortcuts = [
  { key: "g d", label: "Dashboard", action: "/dashboard" },
  { key: "g p", label: "Projetos", action: "/projects" },
  { key: "g c", label: "Containers", action: "/containers" },
  { key: "g m", label: "Monitoramento", action: "/monitoring" },
  { key: "g b", label: "Backups", action: "/backups" },
  { key: "g s", label: "Servidores", action: "/servers" },
  { key: "g k", label: "Clusters", action: "/clusters" },
  { key: "g i", label: "CI/CD", action: "/pipelines" },
  { key: "g t", label: "Marketplace", action: "/templates" },
  { key: "g l", label: "Audit Log", action: "/audit-log" },
  { key: "g e", label: "Configurações", action: "/settings" },
  { key: "n p", label: "Novo Projeto", action: "/projects/new" },
  { key: "?", label: "Atalhos", action: "help" },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

    const key = e.key.toLowerCase();

    if (key === "?" && !pendingKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    if (key === "escape") {
      setShowHelp(false);
      setPendingKey(null);
      return;
    }

    if (pendingKey) {
      const combo = `${pendingKey} ${key}`;
      const shortcut = shortcuts.find(s => s.key === combo);
      if (shortcut && shortcut.action !== "help") {
        e.preventDefault();
        router.push(shortcut.action);
      }
      setPendingKey(null);
      return;
    }

    if (key === "g" || key === "n") {
      setPendingKey(key);
      setTimeout(() => setPendingKey(null), 1000);
      return;
    }
  }, [pendingKey, router]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
      <div className="bg-[#111] border border-white/10 rounded-lg w-96 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Atalhos de Teclado</span>
          </div>
          <button onClick={() => setShowHelp(false)} className="text-white/30 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-1 overflow-y-auto max-h-96">
          <div className="text-[10px] text-white/30 uppercase mb-2 font-medium">Navegação</div>
          {shortcuts.filter(s => s.key.startsWith("g")).map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/50">{s.label}</span>
              <div className="flex gap-0.5">
                {s.key.split(" ").map((k, i) => (
                  <span key={i}>
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60 font-mono">{k}</kbd>
                    {i < s.key.split(" ").length - 1 && <span className="text-white/20 mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[10px] text-white/30 uppercase mt-3 mb-2 font-medium">Ações</div>
          {shortcuts.filter(s => s.key.startsWith("n")).map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/50">{s.label}</span>
              <div className="flex gap-0.5">
                {s.key.split(" ").map((k, i) => (
                  <span key={i}>
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60 font-mono">{k}</kbd>
                    {i < s.key.split(" ").length - 1 && <span className="text-white/20 mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[10px] text-white/30 uppercase mt-3 mb-2 font-medium">Geral</div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-white/50">Mostrar atalhos</span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60 font-mono">?</kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-white/50">Fechar</span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60 font-mono">Esc</kbd>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-white/5 text-center">
          <span className="text-[10px] text-white/20">Pressione a sequência de teclas para navegar</span>
        </div>
      </div>
    </div>
  );
}
