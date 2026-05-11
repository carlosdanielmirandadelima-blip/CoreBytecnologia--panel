"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText, RefreshCw, Download, ArrowDown } from "lucide-react";

interface ContainerLogsProps {
  containerId: string;
}

function cleanLogLine(line: string): string {
  return line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export default function ContainerLogs({ containerId }: ContainerLogsProps) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/containers/${containerId}/logs?tail=500`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, autoRefresh]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `container-${containerId.substring(0, 12)}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const logLines = logs
    .split("\n")
    .map(cleanLogLine)
    .filter((line) => line.length > 0);

  return (
    <Card className="bg-[#111] border-white/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-white/50" />
            Logs do Container
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`text-xs ${
                autoRefresh
                  ? "text-green-400 hover:text-green-300"
                  : "text-white/40 hover:text-white"
              }`}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${
                  autoRefresh ? "animate-spin" : ""
                }`}
              />
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:text-white"
              onClick={scrollToBottom}
              title="Ir para o final"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:text-white"
              onClick={downloadLogs}
              title="Baixar logs"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="bg-black rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-xs scrollbar-thin"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : logLines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30">
              Nenhum log disponível
            </div>
          ) : (
            <>
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className="hover:bg-white/5 py-0.5 px-1 rounded text-white/70 whitespace-pre-wrap break-all"
                >
                  <span className="text-white/20 select-none mr-3">
                    {String(i + 1).padStart(4, " ")}
                  </span>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
