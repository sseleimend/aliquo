import { Clock } from "lucide-react";

const PASSOS = [
  {
    num: "01",
    titulo: "Descreva o produto ou informe o NCM",
    desc: "Digite a descrição em português comum ou já informe o código, se souber. Sem NCM certa, não tem cálculo certo — por isso começamos por aqui.",
    nota: "Leva menos de um minuto",
  },
  {
    num: "02",
    titulo: "Informe itens, frete, seguro e custos",
    desc: "Quantidade, valor, frete internacional, seguro, honorários do despachante e custos recorrentes como Siscomex e THC entram na simulação.",
    nota: "Reuse dados de uma importação anterior para ir mais rápido",
  },
  {
    num: "03",
    titulo: "Revise o cálculo e exporte",
    desc: "II, IPI, PIS, COFINS e ICMS aparecem com a fonte de cada alíquota. Exporte em PDF ou Excel, ou salve no histórico para reusar depois.",
    nota: "PDF e Excel prontos para anexar ao processo",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">
          <span className="eyebrow-dot" />COMO FUNCIONA
        </span>
        <h2 className="mt-4 max-w-2xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          Da descrição do produto ao custo total, em uma sessão
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
          Sem base a importar antes, sem call de implantação. Você começa a primeira simulação
          assim que cria a conta.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PASSOS.map((p) => (
            <div key={p.num}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface2 text-[13px] font-semibold text-text-primary">
                  {p.num}
                </span>
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-text-primary">{p.titulo}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{p.desc}</p>
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
                <Clock className="h-3.5 w-3.5" />
                {p.nota}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
