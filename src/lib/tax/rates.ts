// ─────────────────────────────────────────────────────────────────────────
// Tabelas de alíquotas — PROTÓTIPO (valores de amostra, NÃO oficiais).
// Fonte oficial (TEC/TIPI/Receita) é dependência técnica em aberto (PRD §11).
// ─────────────────────────────────────────────────────────────────────────

import { findByNcm } from "@/lib/ncm/dataset";

// CBS em fase de teste durante a transição da reforma tributária (PRD §7).
export const CBS_RATE = 0.009; // 0,9%

// Alíquotas federais padrão quando o NCM não está na base de amostra.
export const DEFAULT_FEDERAL_RATES = {
  ii: 0.16,
  ipi: 0.0,
  pis: 0.021,
  cofins: 0.0965,
};

export interface FederalRates {
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
}

/**
 * Alíquotas de ICMS por UF (fração) — valores gerais de amostra.
 * Alguns estados incluem FECP/adicional embutido de forma aproximada.
 */
export const ICMS_POR_UF: Record<string, number> = {
  AC: 0.19,
  AL: 0.19,
  AP: 0.18,
  AM: 0.2,
  BA: 0.205,
  CE: 0.2,
  DF: 0.2,
  ES: 0.17,
  GO: 0.19,
  MA: 0.22,
  MT: 0.17,
  MS: 0.17,
  MG: 0.18,
  PA: 0.19,
  PB: 0.2,
  PR: 0.195,
  PE: 0.205,
  PI: 0.21,
  RJ: 0.22,
  RN: 0.18,
  RS: 0.17,
  RO: 0.195,
  RR: 0.2,
  SC: 0.17,
  SP: 0.18,
  SE: 0.19,
  TO: 0.2,
};

export const UF_LIST = Object.keys(ICMS_POR_UF).sort();

/** Retorna as alíquotas federais para um NCM (ou o padrão, sinalizando fallback). */
export function getFederalRates(ncm: string): {
  rates: FederalRates;
  encontrado: boolean;
} {
  const entry = findByNcm(ncm);
  if (entry) return { rates: { ...entry.aliquotas }, encontrado: true };
  return { rates: { ...DEFAULT_FEDERAL_RATES }, encontrado: false };
}

/** Retorna a alíquota de ICMS de uma UF (ou 0.18 como padrão). */
export function getIcmsRate(uf: string): number {
  return ICMS_POR_UF[(uf || "").toUpperCase()] ?? 0.18;
}
