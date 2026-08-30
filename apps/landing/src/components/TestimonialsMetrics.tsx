/**
 * Placeholder deliberado — ver apps/landing/design/copy-pt-br.md.
 * Métricas de uso e depoimentos reais entram aqui só com volume e
 * autorização suficientes para publicar com confiança.
 */
const METRICAS = [
  { valor: "[000]", label: "[métrica real, ex.: horas economizadas por simulação]" },
  { valor: "[000]", label: "[ex.: dias a menos até o despacho]" },
  { valor: "[00%]", label: "[ex.: simulações sem retrabalho]" },
  { valor: "[0.000+]", label: "[ex.: simulações realizadas]" },
];

const DEPOIMENTOS = Array.from({ length: 3 });

export function TestimonialsMetrics() {
  return (
    <section className="border-b border-border bg-ink px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-border">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-border" />
          RESULTADOS
        </span>
        <h2 className="mt-4 max-w-2xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-white">
          Medido no seu próprio cálculo, não em promessa
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-inverse2">
          [Placeholder] Métricas reais de uso entram aqui assim que tivermos volume suficiente para
          publicar com confiança.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {METRICAS.map((m) => (
            <div key={m.label}>
              <p className="text-[28px] font-semibold text-white">{m.valor}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-text-inverse2">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {DEPOIMENTOS.map((_, i) => (
            <div key={i} className="rounded-lg border border-border-dark bg-ink-2 p-5">
              <p className="text-[13.5px] italic leading-relaxed text-text-inverse2">
                “[Depoimento real de cliente entra aqui — não publicar antes de ter autorização]”
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-border-dark text-[12px] font-semibold text-white">
                  ?
                </span>
                <div>
                  <p className="text-[13px] font-medium text-white">[Nome]</p>
                  <p className="text-[12px] text-text-inverse2">[Cargo, Empresa]</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
