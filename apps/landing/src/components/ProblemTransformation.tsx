import { Check, X } from "lucide-react";

const HOJE = [
  "A NCM é escolhida “de olho”, ou copiada da última importação parecida",
  "A alíquota de II e IPI vem de memória ou de uma tabela baixada há meses",
  "O câmbio usado no cálculo não é o mesmo exigido na valoração aduaneira",
  "Cada simulação vira uma planilha nova, sem como provar de onde veio o número depois",
];

const COM_ALIQUO = [
  "A IA sugere candidatos reais da nomenclatura oficial — nunca um código inventado",
  "II e IPI vêm da TEC e da TIPI publicadas, por NCM, sempre na versão vigente",
  "O câmbio é a PTAX de venda do dia útil anterior, a mesma base legal da valoração aduaneira",
  "Cada simulação grava a versão da base, do câmbio e das regras usadas — reproduzível meses depois",
];

export function ProblemTransformation() {
  return (
    <section className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">
          <span className="eyebrow-dot" />O PROBLEMA
        </span>
        <h2 className="mt-4 max-w-2xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          Cada tributo calculado à mão é uma alíquota que pode estar desatualizada.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
          Alíquota errada não aparece na hora — aparece na autuação, ou no preço que não fecha. O
          Aliquo troca a planilha e a memória por base oficial e cálculo reproduzível.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-bg-subtle p-6">
            <h3 className="text-[15px] font-semibold text-text-primary">Hoje</h3>
            <p className="mt-1 text-[13px] text-text-tertiary">
              O número vem de memória, planilha ou de uma importação parecida.
            </p>
            <ul className="mt-5 flex flex-col gap-3.5">
              {HOJE.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[13.5px] text-text-secondary">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-accent-border bg-accent-soft/40 p-6">
            <h3 className="text-[15px] font-semibold text-text-primary">Com o Aliquo</h3>
            <p className="mt-1 text-[13px] text-text-tertiary">
              O número vem da base oficial, e carrega a fonte junto.
            </p>
            <ul className="mt-5 flex flex-col gap-3.5">
              {COM_ALIQUO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[13.5px] text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
