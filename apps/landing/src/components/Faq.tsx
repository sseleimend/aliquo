"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const PERGUNTAS = [
  {
    q: "O plano gratuito é mesmo gratuito?",
    a: "Sim. Cinco simulações por mês, sem cartão e sem prazo para virar cobrança. Para mais volume, Pro e Business são ativados pela nossa equipe.",
  },
  {
    q: "Como funciona a cobrança dos planos pagos?",
    a: "Hoje a ativação do Pro e do Business é manual: você fala com a gente, combinamos o plano e liberamos o acesso na sua conta. Ainda não temos checkout automático.",
  },
  {
    q: "Posso cancelar ou trocar de plano depois?",
    a: "Sim, é só pedir — não tem contrato de fidelidade nem multa.",
  },
  {
    q: "De onde vêm as alíquotas de II, IPI, PIS, COFINS e ICMS?",
    a: "II e IPI vêm da TEC (Gecex/MDIC) e da TIPI (Receita Federal), por NCM. PIS/COFINS seguem a legislação vigente. ICMS por UF ainda é uma estimativa geral — não existe tabela oficial consolidada dos 27 estados, e isso aparece marcado no resultado.",
  },
  {
    q: "O que acontece quando não existe alíquota oficial para o meu NCM?",
    a: "O cálculo é bloqueado, não estimado. É melhor descobrir que falta um dado agora do que confiar num número que ninguém consegue justificar depois.",
  },
  {
    q: "A IA pode classificar minha NCM errada?",
    a: "A IA nunca inventa um código: ela só ordena candidatos reais recuperados da base oficial. Quando dois códigos são parecidos, o Aliquo pergunta o atributo que oficialmente separa um do outro — essa pergunta continua funcionando mesmo com a IA fora do ar.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <span className="eyebrow">
          <span className="eyebrow-dot" />FAQ
        </span>
        <h2 className="mt-4 text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          Perguntas que você já ia fazer
        </h2>

        <div className="mt-8 overflow-hidden rounded-lg border border-border">
          {PERGUNTAS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={i > 0 ? "border-t border-border" : ""}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={`flex w-full items-center justify-between gap-4 px-6 py-5 text-left ${
                    isOpen ? "bg-bg-subtle" : "bg-bg"
                  }`}
                >
                  <span className="text-[15px] font-medium text-text-primary">{item.q}</span>
                  <span
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md ${
                      isOpen ? "bg-accent-soft text-accent" : "bg-surface2 text-text-secondary"
                    }`}
                  >
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {isOpen && (
                  <p className="px-6 pb-5 text-[14px] leading-relaxed text-text-secondary">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[13px] text-text-tertiary">
          Ainda com dúvida? Escreva para{" "}
          <a href="mailto:contato@aliquo.com" className="font-medium text-text-primary underline">
            contato@aliquo.com
          </a>{" "}
          — um humano responde.
        </p>
      </div>
    </section>
  );
}
