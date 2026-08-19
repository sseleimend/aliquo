/**
 * Rateio de custos entre itens da importação (RF-D1).
 *
 * Necessário porque cada item tem sua própria NCM e, portanto, suas próprias
 * alíquotas — o que exige um valor aduaneiro POR ITEM. Frete, seguro, Siscomex
 * e AFRMM chegam no nível do embarque e precisam ser distribuídos antes de
 * qualquer tributo ser calculado.
 *
 * O resíduo de centavos vai para o maior item, de modo que a soma das partes
 * bate exatamente com o total. Sem isso o breakdown não fecha e o usuário
 * perde a confiança no número — que é o produto inteiro.
 */

import type { CriterioRateio, ItemCalculo } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Distribui `total` proporcionalmente a `pesos`, reconciliando centavos. */
export function ratear(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  if (!Number.isFinite(total) || total === 0) return new Array(n).fill(0);

  const soma = pesos.reduce((a, b) => a + b, 0);
  // Sem base de rateio (ex.: todos os pesos zerados), divide igualmente.
  const efetivos = soma > 0 ? pesos : new Array(n).fill(1);
  const somaEfetiva = soma > 0 ? soma : n;

  const partes = efetivos.map((p) => round2((total * p) / somaEfetiva));
  const diferenca = round2(total - partes.reduce((a, b) => a + b, 0));

  if (diferenca !== 0) {
    let maior = 0;
    for (let i = 1; i < partes.length; i++) if (partes[i] > partes[maior]) maior = i;
    partes[maior] = round2(partes[maior] + diferenca);
  }
  return partes;
}

/** Pesos de rateio conforme o critério, por item. */
export function pesosPorCriterio(
  itens: ItemCalculo[],
  criterio: CriterioRateio,
  fobBrlPorItem: number[],
): number[] {
  switch (criterio) {
    case "peso":
      return itens.map((i, idx) => (i.pesoLiquidoKg ?? 0) * (i.quantidade || 1) || fobBrlPorItem[idx]);
    case "quantidade":
      return itens.map((i) => i.quantidade || 1);
    case "valor":
    default:
      return fobBrlPorItem;
  }
}
