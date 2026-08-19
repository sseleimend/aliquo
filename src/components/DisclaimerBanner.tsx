/**
 * Disclaimer visível (RNF-4).
 *
 * O texto mudou junto com o produto: na Fase 1 as alíquotas eram de amostra e
 * era isso que precisava ser avisado. Agora elas são oficiais — o aviso que
 * importa é outro: a CLASSIFICAÇÃO é uma decisão do importador, e é ela que
 * gera multa quando erra.
 */
export function DisclaimerBanner({ texto }: { texto?: string }) {
  return (
    <div className="rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-[13px] leading-relaxed text-warn-text">
      <strong className="font-semibold">Aviso: </strong>
      {texto ??
        "As alíquotas vêm da TEC e da TIPI vigentes, mas a classificação fiscal é " +
          "responsabilidade do importador. Confira o texto oficial antes de confirmar a NCM — " +
          "esta simulação não é parecer fiscal nem jurídico."}
    </div>
  );
}
