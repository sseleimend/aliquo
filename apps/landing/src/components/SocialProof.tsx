/**
 * Placeholder deliberado — ver apps/landing/design/copy-pt-br.md.
 * Não publicar logo ou nome de cliente aqui sem autorização.
 */
const LOGOS = Array.from({ length: 5 });

export function SocialProof() {
  return (
    <section className="border-b border-border px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[13px] text-text-tertiary">
          [Placeholder] Ainda não publicamos clientes reais aqui — esta faixa entra em produção só
          quando tivermos os primeiros nomes autorizados a aparecer.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {LOGOS.map((_, i) => (
            <span
              key={i}
              className="rounded-sm border border-dashed border-border-strong px-4 py-2 text-[12px] text-text-tertiary"
            >
              [Logo do cliente]
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
