"use client";

import { formatBRL, formatData } from "@/lib/format";

export interface CotacaoUi {
  rate: number;
  fonteRotulo: string;
  dataRef?: string;
  asOf?: string;
  stale?: boolean;
  avisos?: string[];
}

/**
 * Exibe a cotação com FONTE e DATA (RF-C1, RNF-1).
 *
 * A Fase 1 mostrava só "(tempo real)" ou "(simulado)" — e "simulado" era uma
 * taxa inventada. Aqui o usuário lê exatamente qual cotação entrou na conta.
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
      <div className="rounded-lg border border-line bg-page px-3 py-2 text-xs text-muted">
        Buscando cotação de {moeda}…
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        fiscal.stale ? "border-warn-border bg-warn-bg text-warn-text" : "border-line bg-page text-ink"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">
          1 {moeda} = {formatBRL(fiscal.rate)}
        </span>
        <span className="text-muted">· {fiscal.fonteRotulo}</span>
      </div>

      {fiscal.asOf && <div className="mt-0.5 text-muted">Cotado em {formatData(fiscal.asOf)}</div>}

      {mercado && typeof divergenciaPct === "number" && (
        <div className="mt-0.5 text-muted">
          Mercado agora: {formatBRL(mercado.rate)} ({divergenciaPct >= 0 ? "+" : ""}
          {divergenciaPct.toFixed(2)}%)
        </div>
      )}

      {fiscal.stale && (
        <div className="mt-1 font-semibold">
          Cotação desatualizada — nenhuma fonte respondeu. Confirme antes de decidir.
        </div>
      )}

      {fiscal.avisos?.map((a) => (
        <div key={a} className="mt-1">
          {a}
        </div>
      ))}
    </div>
  );
}
