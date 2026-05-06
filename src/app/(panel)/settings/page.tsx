"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Info } from "lucide-react";


export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configurações</h2>
        <p className="text-sm text-white/50 mt-1">
          Gerencie as configurações do painel
        </p>
      </div>

      <Card className="bg-[#111] border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <User className="h-4 w-4 text-white/50" />
            Perfil do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/40">Nome</p>
              <p className="text-sm text-white mt-0.5">
                {session?.user?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">Email</p>
              <p className="text-sm text-white mt-0.5">
                {session?.user?.email || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">Cargo</p>
              <Badge variant="secondary" className="mt-0.5">
                <Shield className="h-3 w-3 mr-1" />
                {(session?.user as { role?: string })?.role || "user"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Info className="h-4 w-4 text-white/50" />
            Sobre o Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-black/50 rounded-lg">
            <img
              src="/images/logo-white.png"
              alt="CoreByte"
              className="w-12 h-12"
            />
            <div>
              <h3 className="text-lg font-bold text-white">CoreByte Panel</h3>
              <p className="text-sm text-white/50">
                Painel de gerenciamento Docker
              </p>
              <p className="text-xs text-white/30 mt-1">
                Versão 1.0.0 &middot; CoreByte Tecnologia
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
