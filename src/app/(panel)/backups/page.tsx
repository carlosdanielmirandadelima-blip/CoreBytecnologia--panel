"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  Plus,
  Download,
  RotateCcw,
  Trash2,
  Clock,
  CalendarClock,
  HardDrive,
  Play,
  Pause,
  RefreshCw,
  FolderArchive,
} from "lucide-react";
import { toast } from "sonner";

interface Backup {
  id: string;
  name: string;
  type: string;
  source: string;
  fileName: string;
  fileSize: number;
  status: string;
  scheduleId: string | null;
  createdAt: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  type: string;
  source: string;
  cron: string;
  retention: number;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  backups: Backup[];
  createdAt: string;
}

interface Volume {
  Name: string;
  Driver: string;
  Mountpoint: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cronToText(cron: string): string {
  const parts = cron.split(" ");
  const min = parts[0] || "0";
  const hour = parts[1] || "2";
  const dayOfMonth = parts[2] || "*";
  const dayOfWeek = parts[4] || "*";

  if (dayOfMonth === "*" && dayOfWeek === "*") return `Diário às ${hour}:${min.padStart(2, "0")}`;
  if (dayOfWeek !== "*") {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${days[parseInt(dayOfWeek)] || dayOfWeek} às ${hour}:${min.padStart(2, "0")}`;
  }
  return `Dia ${dayOfMonth} às ${hour}:${min.padStart(2, "0")}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/10 text-green-400 border-0 text-[10px]">Completo</Badge>;
    case "running":
      return <Badge className="bg-blue-500/10 text-blue-400 border-0 text-[10px]">Em progresso</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Falhou</Badge>;
    default:
      return <Badge className="bg-yellow-500/10 text-yellow-400 border-0 text-[10px]">Pendente</Badge>;
  }
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"backups" | "schedules">("backups");

  // New backup form
  const [showNewBackup, setShowNewBackup] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [backupSource, setBackupSource] = useState("");
  const [backupType, setBackupType] = useState("volume");

  // New schedule form
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleSource, setScheduleSource] = useState("");
  const [scheduleType, setScheduleType] = useState("volume");
  const [scheduleCron, setScheduleCron] = useState("0 2 * * *");
  const [scheduleRetention, setScheduleRetention] = useState(7);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, vRes] = await Promise.all([
        fetch("/api/backups"),
        fetch("/api/backups/schedules"),
        fetch("/api/volumes"),
      ]);
      if (bRes.ok) setBackups(await bRes.json());
      if (sRes.ok) setSchedules(await sRes.json());
      if (vRes.ok) {
        const data = await vRes.json();
        setVolumes(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const createBackup = async () => {
    if (!backupName || !backupSource) {
      toast.error("Preencha nome e source");
      return;
    }
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: backupName, type: backupType, source: backupSource }),
      });
      if (res.ok) {
        toast.success("Backup iniciado!");
        setShowNewBackup(false);
        setBackupName("");
        setBackupSource("");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro");
      }
    } catch {
      toast.error("Erro ao criar backup");
    }
  };

  const createSchedule = async () => {
    if (!scheduleName || !scheduleSource) {
      toast.error("Preencha nome e source");
      return;
    }
    try {
      const res = await fetch("/api/backups/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scheduleName,
          type: scheduleType,
          source: scheduleSource,
          cron: scheduleCron,
          retention: scheduleRetention,
        }),
      });
      if (res.ok) {
        toast.success("Agendamento criado!");
        setShowNewSchedule(false);
        setScheduleName("");
        setScheduleSource("");
        fetchData();
      }
    } catch {
      toast.error("Erro ao criar agendamento");
    }
  };

  const restoreBackup = async (id: string) => {
    if (!confirm("Restaurar este backup? Os dados atuais do volume serão substituídos.")) return;
    try {
      const res = await fetch(`/api/backups/${id}/restore`, { method: "POST" });
      if (res.ok) toast.success("Backup restaurado!");
      else toast.error("Erro ao restaurar");
    } catch {
      toast.error("Erro ao restaurar");
    }
  };

  const deleteBackup = async (id: string) => {
    if (!confirm("Remover este backup?")) return;
    try {
      const res = await fetch(`/api/backups/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Backup removido");
        fetchData();
      }
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/backups/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      fetchData();
    } catch {
      toast.error("Erro");
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Remover este agendamento?")) return;
    try {
      const res = await fetch(`/api/backups/schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Agendamento removido");
        fetchData();
      }
    } catch {
      toast.error("Erro ao remover");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Backups</h2>
          <p className="text-sm text-white/50 mt-1">Gerencie backups e agendamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}
            className="border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => tab === "backups" ? setShowNewBackup(true) : setShowNewSchedule(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {tab === "backups" ? "Novo Backup" : "Novo Agendamento"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("backups")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${tab === "backups" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
          <Archive className="h-3.5 w-3.5 inline mr-1.5" />
          Backups ({backups.length})
        </button>
        <button onClick={() => setTab("schedules")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${tab === "schedules" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
          <CalendarClock className="h-3.5 w-3.5 inline mr-1.5" />
          Agendamentos ({schedules.length})
        </button>
      </div>

      {/* New Backup Form */}
      {showNewBackup && tab === "backups" && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={backupName} onChange={(e) => setBackupName(e.target.value)}
                  placeholder="meu-backup" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Tipo</label>
                <select value={backupType} onChange={(e) => setBackupType(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="volume">Volume Docker</option>
                  <option value="container">Container</option>
                  <option value="directory">Diretório</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  {backupType === "volume" ? "Volume" : backupType === "container" ? "Container ID" : "Caminho"}
                </label>
                {backupType === "volume" && volumes.length > 0 ? (
                  <select value={backupSource} onChange={(e) => setBackupSource(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                    <option value="">Selecione um volume</option>
                    {volumes.map((v) => (
                      <option key={v.Name} value={v.Name}>{v.Name}</option>
                    ))}
                  </select>
                ) : (
                  <Input value={backupSource} onChange={(e) => setBackupSource(e.target.value)}
                    placeholder={backupType === "container" ? "container-id" : "/path/to/dir"}
                    className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createBackup} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Archive className="h-3.5 w-3.5 mr-1" /> Criar Backup
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewBackup(false)}
                className="text-white/50 hover:text-white">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Schedule Form */}
      {showNewSchedule && tab === "schedules" && (
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Novo Agendamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="backup-diario" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Volume</label>
                {volumes.length > 0 ? (
                  <select value={scheduleSource} onChange={(e) => setScheduleSource(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                    <option value="">Selecione</option>
                    {volumes.map((v) => (
                      <option key={v.Name} value={v.Name}>{v.Name}</option>
                    ))}
                  </select>
                ) : (
                  <Input value={scheduleSource} onChange={(e) => setScheduleSource(e.target.value)}
                    placeholder="volume-name" className="bg-white/5 border-white/10 text-white h-9 text-sm" />
                )}
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Frequência (cron)</label>
                <select value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                  <option value="0 * * * *">A cada hora</option>
                  <option value="0 */6 * * *">A cada 6 horas</option>
                  <option value="0 */12 * * *">A cada 12 horas</option>
                  <option value="0 2 * * *">Diário (02:00)</option>
                  <option value="0 2 * * 0">Semanal (Dom 02:00)</option>
                  <option value="0 2 1 * *">Mensal (Dia 1 02:00)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Retenção (backups)</label>
                <Input type="number" value={scheduleRetention} onChange={(e) => setScheduleRetention(parseInt(e.target.value) || 7)}
                  min={1} max={100} className="bg-white/5 border-white/10 text-white h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createSchedule} className="bg-blue-600 hover:bg-blue-700 text-white">
                <CalendarClock className="h-3.5 w-3.5 mr-1" /> Criar Agendamento
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewSchedule(false)}
                className="text-white/50 hover:text-white">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backups Tab */}
      {tab === "backups" && (
        <>
          {backups.length === 0 ? (
            <Card className="bg-[#111] border-white/10 border-dashed">
              <CardContent className="py-12 text-center">
                <FolderArchive className="h-10 w-10 text-white/10 mx-auto" />
                <p className="text-sm text-white/40 mt-3">Nenhum backup encontrado</p>
                <p className="text-xs text-white/25 mt-1">Crie um backup de volumes Docker ou diretórios</p>
                <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  onClick={() => setShowNewBackup(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Backup
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <Card key={backup.id} className="bg-[#111] border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-white/5">
                          <Archive className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{backup.name}</p>
                            {statusBadge(backup.status)}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <HardDrive className="h-2.5 w-2.5" /> {backup.source}
                            </span>
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {formatDate(backup.createdAt)}
                            </span>
                            {backup.fileSize > 0 && (
                              <span className="text-[10px] text-white/30">{formatBytes(backup.fileSize)}</span>
                            )}
                            {backup.scheduleId && (
                              <Badge className="bg-purple-500/10 text-purple-400 border-0 text-[9px]">agendado</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {backup.status === "completed" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-white/40 hover:text-white"
                              onClick={() => window.open(`/api/backups/${backup.id}/download`, "_blank")}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-green-400 hover:text-green-300"
                              onClick={() => restoreBackup(backup.id)}>
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                          onClick={() => deleteBackup(backup.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <>
          {schedules.length === 0 ? (
            <Card className="bg-[#111] border-white/10 border-dashed">
              <CardContent className="py-12 text-center">
                <CalendarClock className="h-10 w-10 text-white/10 mx-auto" />
                <p className="text-sm text-white/40 mt-3">Nenhum agendamento criado</p>
                <p className="text-xs text-white/25 mt-1">Agende backups automáticos para seus volumes</p>
                <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  onClick={() => setShowNewSchedule(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Agendamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="bg-[#111] border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg ${schedule.enabled ? "bg-green-500/10" : "bg-white/5"}`}>
                          <CalendarClock className={`h-4 w-4 ${schedule.enabled ? "text-green-400" : "text-white/30"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{schedule.name}</p>
                            <Badge className={`border-0 text-[10px] ${schedule.enabled ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                              {schedule.enabled ? "Ativo" : "Pausado"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <HardDrive className="h-2.5 w-2.5" /> {schedule.source}
                            </span>
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {cronToText(schedule.cron)}
                            </span>
                            <span className="text-[10px] text-white/30">
                              Manter {schedule.retention} backups
                            </span>
                            <span className="text-[10px] text-white/30">
                              {schedule.backups.length} backup{schedule.backups.length !== 1 ? "s" : ""}
                            </span>
                            {schedule.lastRun && (
                              <span className="text-[10px] text-white/20">
                                Último: {formatDate(schedule.lastRun)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm"
                          className={`h-7 text-xs ${schedule.enabled ? "text-yellow-400 hover:text-yellow-300" : "text-green-400 hover:text-green-300"}`}
                          onClick={() => toggleSchedule(schedule.id, schedule.enabled)}>
                          {schedule.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400/50 hover:text-red-400"
                          onClick={() => deleteSchedule(schedule.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
