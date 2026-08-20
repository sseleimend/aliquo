"use client";

import { formatData, formatTaxa } from "@/lib/format";

export interface CotacaoUi {
  rate: number;
  fonteRotulo: string;
  dataRef?: string;
  asOf?: string;
  stale?: boolean;
  avisos?: string[];
}

/**
 * Cotação com FONTE e DATA sempre à vista (RF-C1, RNF-1).
 *
 * A taxa vem grande e monoespaçada, a procedência logo abaixo: o número que
 * entra no valor aduaneiro precisa ser conferível, não decorativo.
 */
export function FxBadge({
  moeda,
  fiscal,
  mercado,
  divergenciaPct,
}: {
  moeda: string;
  fiscal: CotacaoUi | null;
  mercado?: CotacaoUi | null;
  divergenciaPct?: number | null;
}) {
  if (!fiscal) {
    return (
      <div className="rounded border border-fio bg-papel2 px-4 py-3 text-[12.5px] text-fraco">
        Buscando cotação de {moeda}…
      </div>
    );
  }

  return (
    <div
      className={`rounded border px-4 py-3 ${
        fiscal.stale ? "border-nota-fio bg-nota-fraca" : "border-fio bg-papel2"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="secao">Câmbio aplicado</span>
          <span className="font-mono text-[17px] font-medium leading-none text-tinta">
            {formatTaxa(fiscal.rate)}
          </span>
          <span className="text-[12px] text-fraco">por {moeda}</span>
        </div>

        {mercado && typeof divergenciaPct === "number" && (
          <span className="text-[12px] text-tinta2">
            mercado agora {formatTaxa(mercado.rate)}
            <span className="ml-1 font-mono text-fraco">
              ({divergenciaPct >= 0 ? "+" : ""}
              {divergenciaPct.toFixed(2)}%)
            </span>
          </span>
        )}
      </div>

      <p className="mt-1.5 border-t border-fio pt-1.5 text-[11.5px] text-tinta2">
        {fiscal.fonteRotulo}
        {fiscal.asOf && ` · cotado em ${formatData(fiscal.asOf)}`}
      </p>

      {fiscal.stale && (
        <p className="mt-1.5 text-[12px] font-semibold text-nota">
          Cotação desatualizada — nenhuma fonte respondeu. Confirme antes de decidir.
        </p>
      )}

      {fiscal.avisos?.map((a) => (
        <p key={a} className="mt-1 text-[11.5px] text-nota">
          {a}
        </p>
      ))}
    </div>
  );
}
