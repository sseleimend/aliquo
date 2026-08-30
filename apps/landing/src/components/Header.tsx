"use client";

import { useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { APP_URL } from "@/lib/config";

const NAV = [
  { href: "#produto", label: "Produto", desc: "O simulador de landed cost para importação" },
  { href: "#recursos", label: "Recursos", desc: "NCM, tributos, custo total" },
  { href: "#precos", label: "Preços", desc: "Planos a partir de grátis" },
  { href: "#faq", label: "FAQ", desc: "Plano, cobrança, fonte oficial" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#produto">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href={`${APP_URL}/login`} className="btn-secondary">
            Entrar
          </a>
          <a href={`${APP_URL}/cadastro`} className="btn-primary">
            Criar conta grátis
          </a>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-strong text-text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg md:hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Logo />
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border-strong bg-surface2 text-text-primary"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-sm px-3 py-3.5 hover:bg-surface2"
              >
                <span className="flex-1">
                  <span className="block text-[17px] font-semibold tracking-[-0.02em] text-text-primary">
                    {item.label}
                  </span>
                  <span className="block text-[13px] text-text-tertiary">{item.desc}</span>
                </span>
                <ChevronRight className="h-[17px] w-[17px] text-text-tertiary" />
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-bg-subtle px-5 pb-7 pt-5">
            <a href={`${APP_URL}/cadastro`} className="btn-primary w-full">
              Criar conta grátis
            </a>
            <a href={`${APP_URL}/login`} className="btn-secondary w-full">
              Entrar
            </a>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-[13px] text-text-tertiary">
              Sem cartão de crédito
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
