import { CheckCircle2, FileCheck2, History, Scale } from "lucide-react";

export function Features() {
  return (
    <section id="recursos" className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <span className="eyebrow">
          <span className="eyebrow-dot" />O QUE VOCÊ TEM
        </span>
        <h2 className="mt-4 max-w-2xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          Cada número da sua importação, com a fonte à vista.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
          Quatro peças conectadas que substituem a planilha, a memória e a dúvida sobre de onde
          veio a alíquota.
        </p>

        <div className="mt-10 grid gap-4">
          <ClassificacaoNcm />
          <div className="grid gap-4 md:grid-cols-2">
            <MotorTributario />
            <CustoTotal />
          </div>
          <Historico />
        </div>
      </div>
    </section>
  );
}

function ClassificacaoNcm() {
  return (
    <div className="grid gap-6 rounded-lg border border-border p-6 sm:p-8 md:grid-cols-2 md:items-center">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-[12px] font-medium text-text-secondary">
          <FileCheck2 className="h-3.5 w-3.5" />
          Conjunto fechado
        </span>
        <h3 className="mt-4 text-[19px] font-semibold leading-snug text-text-primary">
          A IA nunca inventa um código de NCM
        </h3>
        <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary">
          Você descreve o produto em português comum. A busca recupera candidatos reais da base
          oficial (Siscomex) e a IA só ordena o que já existe — nunca gera um código do zero. Fora
          da lista recuperada, não existe resposta possível.
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
          <CheckCircle2 className="h-4 w-4 text-positive" />
          10.515 NCMs de 8 dígitos na base, 100% com II e IPI oficiais
        </p>
      </div>

      <div className="rounded-md border border-border bg-bg-subtle p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-text-primary">
              Classificar — Aspirador de pó portátil sem fio
            </p>
            <p className="text-[11.5px] text-text-tertiary">
              Busca na base oficial Siscomex · 3 candidatos recuperados
            </p>
          </div>
          <span className="rounded-full bg-positive-soft px-2 py-0.5 text-[11px] font-medium text-positive">
            Confirmado
          </span>
        </div>
        <p className="mt-3 text-[13px] italic text-text-secondary">
          “aspirador portátil, motor elétrico, tanque pequeno”
        </p>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <PreviewRow label="Recuperado" text="8508.11.00 — Aspiradores com motor elétrico incorporado, potência ≤ 1.500 W" />
          <PreviewRow label="Confirmado" text="Tributos calculados: II 20% (TEC) · IPI 6,5% (TIPI)" />
          <PreviewRow label="Fonte" text="Res. Gecex 926/2026 · câmbio PTAX do dia útil anterior" />
        </div>
        <p className="mt-4 border-t border-border pt-3 text-[11.5px] text-text-tertiary">
          Nenhum código fora da base oficial foi apresentado
        </p>
      </div>
    </div>
  );
}

function PreviewRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
        <p className="text-[13px] text-text-secondary">{text}</p>
      </div>
    </div>
  );
}

function MotorTributario() {
  return (
    <div className="rounded-lg border border-border p-6 sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-[12px] font-medium text-text-secondary">
        <Scale className="h-3.5 w-3.5" />
        Tributos
      </span>
      <h3 className="mt-4 text-[17px] font-semibold leading-snug text-text-primary">
        Cada alíquota aponta para a fonte que a definiu
      </h3>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
        Imposto de Importação, IPI, PIS, COFINS e ICMS aparecem com a alíquota, a base legal, o ato
        normativo e a data de vigência — na tela e no PDF. Sem dado oficial, o cálculo é bloqueado
        em vez de estimado.
      </p>

      <div className="mt-5 rounded-md border border-border bg-bg-subtle p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-text-primary">Imposto de Importação — II</p>
            <p className="text-[11px] text-text-tertiary">TEC — Res. Gecex 272/2021 · vigente</p>
          </div>
          <span className="text-[15px] font-semibold text-text-primary">20%</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-[12px] text-text-secondary">
          <p>IPI 6,5% — TIPI, Decreto 11.158/2022</p>
          <p>ICMS — estimativa por UF, ver SEFAZ</p>
        </div>
      </div>
    </div>
  );
}

function CustoTotal() {
  const linhas = [
    { l: "Tributos (II, IPI, PIS, COFINS, ICMS)", a: "R$ 4.940,00" },
    { l: "Frete, seguro e despachante", a: "R$ 2.100,00" },
  ];
  return (
    <div className="rounded-lg border border-border p-6 sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-[12px] font-medium text-text-secondary">
        Landed cost
      </span>
      <h3 className="mt-4 text-[17px] font-semibold leading-snug text-text-primary">
        O custo total de nacionalização, pronto para exportar
      </h3>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
        Frete, seguro, Siscomex, THC, armazenagem, honorários do despachante e tributos se
        consolidam em um único número. Exporte em PDF ou Excel — e reimporte no Aliquo sem perder
        um dado, porque o documento carrega os seus próprios dados junto.
      </p>

      <div className="mt-5 rounded-md border border-border bg-bg-subtle p-4">
        <p className="text-[13px] font-medium text-text-primary">
          Custo total — Aspirador de pó portátil
        </p>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {linhas.map((r) => (
            <div key={r.l} className="flex justify-between text-[12.5px] text-text-secondary">
              <span>{r.l}</span>
              <span className="font-medium text-text-primary">{r.a}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3">
          <span className="text-[13px] font-semibold text-text-primary">Custo total de nacionalização</span>
          <span className="text-[15px] font-semibold text-text-primary">R$ 42.180,00</span>
        </div>
        <p className="mt-3 text-[11px] text-text-tertiary">
          Calculado a partir da NCM 8508.11.00 confirmada — sem entrada manual
        </p>
      </div>
    </div>
  );
}

function Historico() {
  const eventos = [
    ["NCM 8508.11.00 confirmada a partir da base Siscomex", "09:12"],
    ["Alíquotas de II e IPI atualizadas pela TEC/TIPI vigente", "10:04"],
    ["Câmbio PTAX do dia útil anterior aplicado ao cálculo", "11:38"],
    ["Simulação duplicada do histórico para nova cotação", "13:20"],
    ["PDF exportado com dados e fonte de cada tributo", "16:45"],
  ];

  return (
    <div className="grid gap-6 rounded-lg border border-border p-6 sm:p-8 md:grid-cols-2 md:items-center">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-[12px] font-medium text-text-secondary">
          <History className="h-3.5 w-3.5" />
          Histórico
        </span>
        <h3 className="mt-4 text-[17px] font-semibold leading-snug text-text-primary">
          Comece a próxima simulação a partir da última
        </h3>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
          Reuse produtos, NCMs confirmadas e critério de rateio de uma importação anterior — câmbio
          e alíquotas são sempre recalculados na hora, nunca copiados. Migrando de outra planilha?
          Baixe o modelo, preencha e anexe: os tributos são recalculados com as alíquotas oficiais
          de hoje.
        </p>
        <p className="mt-4 text-[12px] text-text-tertiary">
          Fonte: Receita Federal · Siscomex · Gecex/MDIC · Banco Central (PTAX)
        </p>
      </div>

      <div className="rounded-md border border-border bg-bg-subtle p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-text-primary">Histórico — hoje</p>
          <p className="text-[11px] text-text-tertiary">3 fontes oficiais consultadas</p>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {eventos.map(([texto, hora]) => (
            <div key={texto} className="flex items-start justify-between gap-3 text-[12.5px]">
              <span className="text-text-secondary">{texto}</span>
              <span className="shrink-0 text-text-tertiary">{hora}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
