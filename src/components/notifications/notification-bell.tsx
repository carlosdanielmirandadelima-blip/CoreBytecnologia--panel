"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

function typeIcon(type: string) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "success": return <CheckCircle className={`${cls} text-green-400`} />;
    case "warning": return <AlertTriangle className={`${cls} text-yellow-400`} />;
    case "error": return <XCircle className={`${cls} text-red-400`} />;
    default: return <Info className={`${cls} text-blue-400`} />;
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnread(data.unread || 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0 text-white/40 hover:text-white"
        onClick={() => setOpen(!open)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <span className="text-xs font-medium text-white">Notificações</span>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-400 hover:text-blue-300 px-2" onClick={markAllRead}>
                  <Check className="h-2.5 w-2.5 mr-1" /> Marcar lidas
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="h-6 w-6 text-white/10 mx-auto" />
                  <p className="text-[10px] text-white/25 mt-2">Sem notificações</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-colors ${!n.read ? "bg-blue-500/5" : ""}`}>
                    <div className="mt-0.5">{typeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0" onClick={() => !n.read && markRead(n.id)}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${n.read ? "text-white/40" : "text-white font-medium"}`}>{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                      </div>
                      {n.message && <p className="text-[10px] text-white/25 truncate">{n.message}</p>}
                      <span className="text-[9px] text-white/15">{timeAgo(n.createdAt)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-white/10 hover:text-red-400 flex-shrink-0"
                      onClick={() => deleteNotification(n.id)}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
