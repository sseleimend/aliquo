// Disclaimer visível (PRD §8) — presente nas telas do produto e nos candidatos de IA.
export function DisclaimerBanner({ texto }: { texto?: string }) {
  return (
    <div className="rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-[13px] leading-relaxed text-warn-text">
      <strong className="font-semibold">Aviso: </strong>
      {texto ??
        "Protótipo. As alíquotas e as sugestões de NCM são valores de amostra e NÃO substituem a fonte oficial (Receita Federal). Sem valor fiscal ou jurídico."}
    </div>
  );
}
