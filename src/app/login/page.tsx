"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Tela de login.
 *
 * Passou a suportar o segundo fator: quando a conta tem 2FA ativo, o
 * servidor devolve o aviso TWO_FACTOR_REQUIRED e o campo de código aparece.
 * Antes o 2FA podia estar "ativo" no painel e o login entrava só com a senha.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      ...(needsCode ? { code } : {}),
      redirect: false,
    });

    if (result?.error) {
      // O erro chega como "CredentialsSignin" com o detalhe na URL.
      const raw = String(result.error ?? "");
      const url = String((result as { url?: string }).url ?? "");
      const detail = `${raw} ${url}`;

      if (detail.includes("TWO_FACTOR_REQUIRED")) {
        setNeedsCode(true);
        setError("");
      } else if (detail.includes("TWO_FACTOR_INVALID")) {
        setNeedsCode(true);
        setError("Código do autenticador incorreto. Verifique o relógio do celular e tente de novo.");
      } else if (detail.includes("RATE_LIMITED")) {
        setError("Muitas tentativas. Aguarde 15 minutos e tente novamente.");
      } else {
        setError("E-mail ou senha inválidos");
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

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
            <h1 className="text-2xl font-bold text-white">CoreByte Panel</h1>
            <p className="text-sm text-white/50 mt-1">
              {needsCode ? "Confirme o código do autenticador" : "Faça login para acessar o painel"}
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {!needsCode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/70">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-white/70">
                    Senha
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white/70 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  Código de 6 dígitos
                </Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="bg-white/5 border-white/10 text-white text-center text-lg tracking-[0.4em] placeholder:text-white/20"
                  required
                />
                <p className="text-[11px] text-white/40">
                  Abra o aplicativo autenticador (Google Authenticator, Authy, 1Password…).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNeedsCode(false);
                    setCode("");
                    setError("");
                  }}
                  className="text-[11px] text-white/40 hover:text-white/70 underline"
                >
                  Voltar
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : needsCode ? (
                "Confirmar código"
              ) : (
                "Entrar"
              )}
            </Button>
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
