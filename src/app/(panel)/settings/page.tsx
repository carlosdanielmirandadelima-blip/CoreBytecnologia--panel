"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Shield, Info, Save, Loader2, Key, Plus, Trash2, Variable, Plug, Smartphone,
} from "lucide-react";
import { toast } from "sonner";

interface GlobalEnvVar {
  id: string;
  key: string;
  value: string;
  description: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [globalEnvVars, setGlobalEnvVars] = useState<GlobalEnvVar[]>([]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [newEnvDesc, setNewEnvDesc] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const [cfToken, setCfToken] = useState("");
  const [savingCf, setSavingCf] = useState(false);
  const [twoFaQr, setTwoFaQr] = useState("");
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  const fetchGlobalEnv = useCallback(async () => {
    try {
      const res = await fetch("/api/global-env");
      const data = await res.json();
      setGlobalEnvVars(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { fetchGlobalEnv(); }, [fetchGlobalEnv]);

  useEffect(() => {
    fetch("/api/settings?key=cloudflare_api_token").then(r => r.json()).then(d => { if (d.value) setCfToken(d.value); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/users/profile").then(r => r.json()).then(d => { if (d.twoFactorEnabled) setTwoFaEnabled(true); }).catch(() => {});
  }, []);

  const handleEnable2FA = async () => {
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/two-factor/enable", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTwoFaQr(data.qrCode);
        setTwoFaSecret(data.secret);
      } else toast.error("Erro ao gerar QR code");
    } catch { toast.error("Erro"); }
    finally { setTwoFaLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (!twoFaCode || twoFaCode.length !== 6) { toast.error("Insira o código de 6 dígitos"); return; }
    try {
      const res = await fetch("/api/two-factor/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFaCode }),
      });
      if (res.ok) { toast.success("2FA ativado!"); setTwoFaEnabled(true); setTwoFaQr(""); setTwoFaCode(""); }
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error("Erro"); }
  };

  const handleDisable2FA = async () => {
    if (!disableCode) { toast.error("Insira o código"); return; }
    try {
      const res = await fetch("/api/two-factor/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      if (res.ok) { toast.success("2FA desativado"); setTwoFaEnabled(false); setDisableCode(""); }
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error("Erro"); }
  };

  const handleSaveCfToken = async () => {
    setSavingCf(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "cloudflare_api_token", value: cfToken }),
      });
      if (res.ok) toast.success("Token Cloudflare salvo!");
      else toast.error("Erro ao salvar");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSavingCf(false); }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Perfil atualizado!");
      else toast.error(data.error);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Senha alterada!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAddEnv = async () => {
    if (!newEnvKey) { toast.error("Chave é obrigatória"); return; }
    setAddingEnv(true);
    try {
      const res = await fetch("/api/global-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey, value: newEnvValue, description: newEnvDesc }),
      });
      if (res.ok) {
        toast.success("Variável adicionada!");
        setNewEnvKey("");
        setNewEnvValue("");
        setNewEnvDesc("");
        fetchGlobalEnv();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao adicionar");
    } finally {
      setAddingEnv(false);
    }
  };

  const handleDeleteEnv = async (id: string) => {
    if (!confirm("Remover esta variável?")) return;
    try {
      await fetch(`/api/global-env?id=${id}`, { method: "DELETE" });
      toast.success("Variável removida");
      fetchGlobalEnv();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configurações</h2>
        <p className="text-sm text-white/50 mt-1">Gerencie as configurações do painel</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="profile" className="data-[state=active]:bg-white/10">
            <User className="h-4 w-4 mr-1" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-white/10">
            <Key className="h-4 w-4 mr-1" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="env" className="data-[state=active]:bg-white/10">
            <Variable className="h-4 w-4 mr-1" /> Variáveis Globais
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-white/10">
            <Plug className="h-4 w-4 mr-1" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-white/10">
            <Info className="h-4 w-4 mr-1" /> Sobre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <User className="h-4 w-4 text-white/50" /> Perfil do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-white/60 text-xs">Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/60 text-xs">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40">Cargo</p>
                <Badge variant="secondary" className="mt-1">
                  <Shield className="h-3 w-3 mr-1" />
                  {(session?.user as { role?: string })?.role || "user"}
                </Badge>
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar Perfil
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-white/50" /> Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Senha Atual</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Nova Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" placeholder="Min. 6 caracteres" />
              </div>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Confirmar Nova Senha</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />} Alterar Senha
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-white/50" /> Autenticação em Duas Etapas (2FA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {twoFaEnabled ? (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                    <Shield className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">2FA está ativado</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60 text-xs">Código para desativar</Label>
                    <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} maxLength={6}
                      className="bg-white/5 border-white/10 text-white font-mono" placeholder="000000" />
                    <Button size="sm" variant="outline" className="border-red-500/20 text-red-400" onClick={handleDisable2FA}>
                      Desativar 2FA
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {!twoFaQr ? (
                    <>
                      <p className="text-xs text-white/40">Adicione uma camada extra de segurança usando um app autenticador (Google Authenticator, Authy, etc)</p>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEnable2FA} disabled={twoFaLoading}>
                        {twoFaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Smartphone className="h-4 w-4 mr-1" />}
                        Configurar 2FA
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-white/40">Escaneie o QR code com seu app autenticador:</p>
                      <div className="flex justify-center p-4 bg-white rounded-lg w-fit">
                        <img src={twoFaQr} alt="QR Code 2FA" className="w-48 h-48" />
                      </div>
                      <p className="text-[10px] text-white/30">Ou insira manualmente: <code className="text-blue-400">{twoFaSecret}</code></p>
                      <div className="space-y-2">
                        <Label className="text-white/60 text-xs">Código de verificação</Label>
                        <Input value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} maxLength={6}
                          className="bg-white/5 border-white/10 text-white font-mono" placeholder="000000" />
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleVerify2FA}>
                          Verificar e Ativar
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Variable className="h-4 w-4 text-white/50" /> Variáveis de Ambiente Globais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-white/30">Variáveis disponíveis para todos os projetos</p>

              <div className="flex gap-2">
                <Input value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)}
                  className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="CHAVE" />
                <Input value={newEnvValue} onChange={(e) => setNewEnvValue(e.target.value)}
                  className="bg-white/5 border-white/10 text-white font-mono text-sm" placeholder="valor" />
                <Input value={newEnvDesc} onChange={(e) => setNewEnvDesc(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-sm" placeholder="descrição" />
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={handleAddEnv} disabled={addingEnv}>
                  {addingEnv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {globalEnvVars.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">Nenhuma variável global configurada</p>
              ) : (
                <div className="space-y-2">
                  {globalEnvVars.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      <code className="text-sm text-blue-400 font-mono min-w-[120px]">{ev.key}</code>
                      <code className="text-sm text-white/60 font-mono flex-1">{ev.value}</code>
                      {ev.description && <span className="text-xs text-white/30">{ev.description}</span>}
                      <Button variant="ghost" size="icon" className="text-red-400 h-7 w-7 shrink-0"
                        onClick={() => handleDeleteEnv(ev.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plug className="h-4 w-4 text-white/50" /> Cloudflare API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <p className="text-xs text-white/30">Configure o token da API Cloudflare para gerenciar DNS. Crie um token em <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" className="text-blue-400 hover:underline">dash.cloudflare.com</a> com permissão de Zone.DNS Edit.</p>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">API Token</Label>
                <Input type="password" value={cfToken} onChange={(e) => setCfToken(e.target.value)}
                  className="bg-white/5 border-white/10 text-white font-mono" placeholder="Bearer token..." />
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveCfToken} disabled={savingCf}>
                {savingCf ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar Token
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Info className="h-4 w-4 text-white/50" /> Sobre o Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 bg-black/50 rounded-lg">
                <img src="/assets/logo-white.png" alt="CoreByte" className="w-12 h-12" />
                <div>
                  <h3 className="text-lg font-bold text-white">CoreByte Panel</h3>
                  <p className="text-sm text-white/50">Painel de gerenciamento Docker</p>
                  <p className="text-xs text-white/30 mt-1">Versão 2.0.0 &middot; CoreByte Tecnologia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
