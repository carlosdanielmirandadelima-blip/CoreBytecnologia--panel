"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, ShieldCheck, Check, X } from "lucide-react";

/**
 * Primeiro acesso do painel.
 *
 * Quando não existe nenhum usuário, esta tela aparece automaticamente para
 * o dono definir o e-mail e a senha do administrador — sem precisar rodar
 * comando no servidor.
 *
 * Regras de segurança:
 *  - só funciona enquanto NÃO existe usuário;
 *  - exige o código de configuração (COREBYTE_SETUP_TOKEN), mostrado no
 *    terminal pelo instalador, OU acesso de dentro da rede do servidor.
 *    Isso impede que um visitante qualquer crie o admin antes de você.
 */

interface Status {
  needsSetup: boolean;
  hint: string;
  canSetupFromBrowser: boolean;
  canSetupFromHere: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((d: Status) => {
        setStatus(d);
        // Painel já configurado: manda para o login.
        if (!d.needsSetup) router.replace("/login");
      })
      .catch(() => setStatus(null));
  }, [router]);

  const rules = [
    { ok: password.length >= 10, label: "Pelo menos 10 caracteres" },
    { ok: /[a-zA-Z]/.test(password), label: "Contém letras" },
    { ok: /[0-9]/.test(password), label: "Contém números" },
    { ok: password.length > 0 && password === confirm, label: "As senhas coincidem" },
  ];
  const allRulesOk = rules.every((r) => r.ok);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const ready = allRulesOk && emailOk && name.trim().length > 0 && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ready) {
      setError("Revise os campos destacados antes de continuar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(code ? { "x-corebyte-setup": code } : {}),
        },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace("/login?setup=ok");
      } else {
        setError(data.error ?? "Não foi possível criar o administrador.");
      }
    } catch {
      setError("Falha de conexão com o painel.");
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  // Já configurado: evita mostrar o formulário enquanto redireciona.
  if (!status.needsSetup) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <p className="text-sm text-white/50">O painel já está configurado. Redirecionando para o login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

      <Card className="w-full max-w-md bg-[#111] border-white/10 relative">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-white.png" alt="CoreByte Tecnologia" className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bem-vindo ao CoreByte</h1>
            <p className="text-sm text-white/50 mt-1">
              Defina a conta de administrador para começar
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {!status.canSetupFromHere && (
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white/70 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  Código de configuração
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="exibido pelo instalador no terminal"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
                  autoComplete="off"
                />
                <p className="text-[11px] text-white/40">
                  Este código evita que outra pessoa crie o administrador antes de você. Ele está no
                  arquivo <code className="text-blue-400">.env</code> do servidor e foi mostrado ao final
                  da instalação.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="setup-name" className="text-white/70">
                Seu nome
              </Label>
              <Input
                id="setup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como você quer ser chamado"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-email" className="text-white/70">
                E-mail de acesso
              </Label>
              <Input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@seudominio.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoComplete="username"
                required
              />
              {email.length > 0 && !emailOk && (
                <p className="text-[11px] text-amber-400">Informe um e-mail válido.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-pass" className="text-white/70">
                Senha
              </Label>
              <Input
                id="setup-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-confirm" className="text-white/70">
                Repita a senha
              </Label>
              <Input
                id="setup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoComplete="new-password"
                required
              />
            </div>

            <ul className="space-y-1.5 pt-1">
              {rules.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-[11px]">
                  {r.ok ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-white/25" />
                  )}
                  <span className={r.ok ? "text-emerald-400" : "text-white/40"}>{r.label}</span>
                </li>
              ))}
            </ul>

            <Button
              type="submit"
              disabled={!ready}
              className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando…
                </>
              ) : (
                "Criar administrador e entrar"
              )}
            </Button>

            <p className="text-[11px] text-white/30 text-center">
              Depois de criar a conta, ative o 2FA em Configurações para proteger o acesso.
            </p>
          </form>

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-white.png" alt="CoreByte" className="opacity-30 w-3.5 h-3.5" />
            <span className="text-[10px] text-white/30">CoreByte Tecnologia</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
