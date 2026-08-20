"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

/**
 * Barra lateral do painel.
 *
 * A marca de seleção é um FIO à esquerda, não um bloco colorido — a mesma
 * régua que estrutura o resto do documento. O e-mail chega por prop do layout
 * (que já é servidor e já tem a sessão) em vez de um `useSession` — sem isso
 * o rodapé pisca vazio até a sessão chegar pela rede.
 */

const SECOES: Array<{ titulo: string; itens: Array<{ href: string; rotulo: string }> }> = [
  {
    titulo: "Operação",
    itens: [
      { href: "/simulador", rotulo: "Simulador" },
      { href: "/historico", rotulo: "Histórico" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [{ href: "/conta/despachantes", rotulo: "Despachantes e custos" }],
  },
];

export function BarraLateral({ email }: { email?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[228px] shrink-0 flex-col border-r border-fio bg-folha">
      {/* Marca */}
      <div className="border-b border-fio px-5 py-4">
        <Link href="/simulador" className="block">
          <span className="font-serifa text-[19px] font-semibold leading-none text-tinta">
            Aliquo<span className="text-caneta">.</span>
          </span>
          <p className="mt-1.5 text-rotulo font-semibold uppercase text-fraco">
            Custo de importação
          </p>
        </Link>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4">
        {SECOES.map((secao) => (
          <div key={secao.titulo} className="mb-5">
            <p className="px-5 pb-2 text-rotulo font-semibold uppercase text-fraco">
              {secao.titulo}
            </p>
            <ul>
              {secao.itens.map((item) => {
                const ativo =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? "page" : undefined}
                      className={`flex border-l-2 px-5 py-2 text-[13.5px] transition-colors ${
                        ativo
                          ? "border-l-caneta bg-caneta-fraca font-medium text-caneta-forte"
                          : "border-l-transparent text-tinta2 hover:border-l-fio2 hover:bg-papel2"
                      }`}
                    >
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Conta */}
      <div className="border-t border-fio px-5 py-3">
        {email && (
          <p className="truncate text-[12px] text-tinta2" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 text-[12px] text-fraco underline-offset-2 hover:text-carimbo hover:underline"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
