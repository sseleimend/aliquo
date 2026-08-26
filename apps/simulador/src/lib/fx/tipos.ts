export type FinalidadeCambio = "fiscal" | "mercado";

export interface Cotacao {
  moeda: string;
  rate: number;
  fonte: string; // "bcb-ptax" | "awesomeapi"
  fonteRotulo: string; // texto exibido ao usuário (RNF-1)
  finalidade: FinalidadeCambio;
  tipo: string; // "venda" | "ask"
  /** Momento da cotação segundo a fonte. */
  asOf: string;
  /** Data de referência da cotação ("2026-08-17"). */
  dataRef: string;
  /** true = cotação antiga reaproveitada porque a fonte não respondeu. */
  stale: boolean;
  idadeHoras?: number;
  avisos: string[];
}

/** Erro quando não há NENHUMA cotação utilizável — nem fresca, nem em cache. */
export class CambioIndisponivelError extends Error {
  readonly exigeCambioManual = true;
  constructor(readonly moeda: string) {
    super(
      `Não foi possível obter a cotação de ${moeda} em nenhuma fonte e não há ` +
        `cotação anterior em cache. Informe a taxa manualmente para prosseguir.`,
    );
    this.name = "CambioIndisponivelError";
  }
}

export const MOEDAS_SUPORTADAS = [
  "USD", "EUR", "CNY", "GBP", "JPY", "CHF", "CAD", "AUD", "MXN",
] as const;

/** Data no formato MM-DD-YYYY exigido pela API do Banco Central. */
export function paraFormatoBcb(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

export function paraIsoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Último dia útil anterior a `base`.
 *
 * Para valoração aduaneira a taxa relevante é a PTAX de fechamento do dia útil
 * anterior ao registro da DI — não a cotação de mercado do instante da consulta.
 */
export function diaUtilAnterior(base = new Date()): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}
