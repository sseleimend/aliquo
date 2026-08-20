/**
 * Disclaimer visível (RNF-4).
 *
 * O texto acompanha o produto: as alíquotas hoje são oficiais, então o aviso
 * que importa é outro — a CLASSIFICAÇÃO é decisão do importador, e é ela que
 * gera multa quando erra.
 */
export function DisclaimerBanner({ texto }: { texto?: string }) {
  return (
    <div className="aviso-nota">
      <span className="secao mr-2">Aviso</span>
      {texto ??
        "As alíquotas vêm da TEC e da TIPI vigentes, mas a classificação fiscal é responsabilidade do importador. Confira o texto oficial antes de confirmar a NCM — esta simulação não é parecer fiscal nem jurídico."}
    </div>
  );
}
