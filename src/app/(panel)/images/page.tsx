"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, RefreshCw } from "lucide-react";

interface DockerImage {
  id: string;
  shortId: string;
  tags: string[];
  size: number;
  created: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ImagesPage() {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImages = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/images", { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) setImages(await res.json());
    } catch {
      // timeout or network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

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
          <h2 className="text-2xl font-bold text-white">Imagens</h2>
          <p className="text-sm text-white/50 mt-1">
            Imagens Docker disponíveis no servidor
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchImages}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {images.length === 0 ? (
        <Card className="bg-[#111] border-white/10">
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 text-white/10 mx-auto" />
            <p className="text-sm text-white/40 mt-3">
              Nenhuma imagem encontrada
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {images.map((image) => (
            <Card
              key={image.id}
              className="bg-[#111] border-white/10"
            >
              <CardHeader className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm text-white font-mono">
                      {image.shortId}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {image.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {image.tags.length === 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-white/10 text-white/30"
                        >
                          &lt;none&gt;
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-white/50">
                    {formatBytes(image.size)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-xs text-white/30">
                  Criada em{" "}
                  {new Date(image.created).toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
