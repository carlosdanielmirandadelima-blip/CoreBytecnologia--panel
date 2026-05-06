"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Erro ao criar conta");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

      <Card className="w-full max-w-md bg-[#111] border-white/10 relative">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <img
              src="/images/logo-white.png"
              alt="CoreByte Tecnologia" className="w-12 h-12"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Criar Conta</h1>
            <p className="text-sm text-white/50 mt-1">
              Registre-se para acessar o CoreByte Panel
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

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/70">
                Nome
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/70">
                Confirmar Senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/40">
              Já tem conta?{" "}
              <Link
                href="/login"
                className="text-white/70 hover:text-white underline"
              >
                Fazer login
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
            <img
              src="/images/logo-white.png"
              alt="CoreByte"
              className="opacity-30 w-3.5 h-3.5"
            />
            <span className="text-[10px] text-white/30">
              CoreByte Tecnologia
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
