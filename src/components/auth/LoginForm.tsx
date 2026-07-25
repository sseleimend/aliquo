"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export function LoginForm({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("demo@aliquo.com");
  const [password, setPassword] = useState("demo123");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
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
            required
          />
        </div>

        {erro ? (
          <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger-text">{erro}</p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="btn-secondary w-full"
          >
            Continuar com Google
          </button>
        </>
      ) : (
        <p className="text-center text-xs text-muted">
          Login com Google desativado (configure AUTH_GOOGLE_ID/SECRET no .env).
        </p>
      )}

      <p className="text-center text-sm text-ink2">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-accent-text hover:underline">
          Criar conta
        </Link>
      </p>
      <p className="rounded-md bg-teal-bg px-3 py-2 text-center text-xs text-teal-text">
        Conta demo pré-preenchida: <strong>demo@aliquo.com</strong> / <strong>demo123</strong>
      </p>
    </div>
  );
}
