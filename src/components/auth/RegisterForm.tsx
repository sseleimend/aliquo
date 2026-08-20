"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { SeletorPlano } from "./SeletorPlano";

export function RegisterForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plano, setPlano] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, email, password, plano: plano || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao criar conta.");
        setLoading(false);
        return;
      }
      // Autentica automaticamente após o cadastro.
      const login = await signIn("credentials", { email, password, redirect: false });
      if (login?.error) {
        router.push("/login");
        return;
      }
      router.push("/simulador");
      router.refresh();
    } catch {
      setErro("Erro de rede. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label" htmlFor="nome">
          Nome
        </label>
        <input id="nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <p className="mt-1 text-xs text-fraco">Mínimo de 6 caracteres.</p>
      </div>

      <SeletorPlano valor={plano} onChange={setPlano} />

      <p className="text-xs text-fraco">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="text-caneta hover:underline">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="text-caneta hover:underline">
          política de privacidade
        </Link>
        .
      </p>

      {erro ? (
        <p className="rounded-md bg-carimbo-fraca px-3 py-2 text-sm text-carimbo">{erro}</p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-center text-sm text-tinta2">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-caneta hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
