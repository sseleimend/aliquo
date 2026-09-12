import { Check } from "lucide-react";
import { APP_URL } from "@/lib/config";

const NOTAS = ["Sem cartão de crédito", "5 simulações grátis por mês", "Cancele quando quiser"];

export function FinalCta() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-4xl rounded-lg bg-ink px-6 py-14 text-center sm:px-14">
        <h2 className="text-[clamp(24px,4vw,36px)] font-semibold leading-tight tracking-[-0.02em] text-white">
          Pare de estimar. Comece a calcular com fonte.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-text-inverse2">
          Crie sua conta gratuita e descubra a NCM, os tributos e o custo total da sua próxima
          importação em minutos.
        </p>

        <a
          href={`${APP_URL}/cadastro`}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-sm bg-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface2"
        >
          Criar conta grátis
        </a>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {NOTAS.map((n) => (
            <span key={n} className="flex items-center gap-1.5 text-[13px] text-text-inverse2">
              <Check className="h-3.5 w-3.5" />
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
