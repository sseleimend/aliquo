import { Check } from "lucide-react";
import { ProductPreview } from "./ProductPreview";
import { APP_URL } from "@/lib/config";

export function Hero() {
  return (
    <section id="produto" className="border-b border-border px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-bg py-1.5 pl-3 pr-1.5 text-[13px] font-medium text-text-secondary">
          10.515 NCMs · 100% com II e IPI oficiais
        </span>

        <h1 className="mt-6 max-w-3xl text-[clamp(32px,5vw,52px)] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary">
          O custo da sua importação, com a fonte de cada alíquota à vista.
        </h1>

        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-text-secondary">
          Descubra a NCM na base oficial da Receita, calcule II, IPI, PIS, COFINS e ICMS com as
          alíquotas publicadas, e chegue ao custo total de nacionalização — sabendo de onde veio
          cada número.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={`${APP_URL}/cadastro`} className="btn-primary">
            Criar conta grátis
          </a>
          <a href="#recursos" className="btn-secondary">
            Ver uma simulação real
          </a>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-[13px] text-text-tertiary">
          <Check className="h-3.5 w-3.5 text-positive" />
          Sem cartão de crédito · Plano gratuito com 5 simulações por mês · Resultado em minutos
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-5xl">
        <ProductPreview />
      </div>
    </section>
  );
}
