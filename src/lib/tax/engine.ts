// ─────────────────────────────────────────────────────────────────────────
// Motor de cálculo tributário e de landed cost — NÚCLEO do produto.
//
// Regra de negócio central (PRD §7): o NCM é a "única verdade" para determinar
// a tributação. O cálculo segue as bases descritas na seção 7 do PRD.
//
// AVISO: alíquotas e bases são aproximações de protótipo. Ver lib/tax/rates.ts.
// ─────────────────────────────────────────────────────────────────────────

import { findByNcm } from "@/lib/ncm/dataset";
import {
  CBS_RATE,
  getFederalRates,
  getIcmsRate,
} from "@/lib/tax/rates";
import type {
  CostLineItem,
  TaxInput,
  TaxLineItem,
  TaxResult,
} from "@/lib/tax/types";

/** Arredonda para 2 casas decimais (centavos). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** THC sugerido como ≈1% do valor da carga (PRD §7) — apenas referência. */
export function sugestaoThc(valorCargaBrl: number): number {
  return round2(valorCargaBrl * 0.01);
}

export function calcularTributos(inputRaw: TaxInput): TaxResult {
  const avisos: string[] = [];

  const input: TaxInput = {
    ...inputRaw,
    fobMoeda: num(inputRaw.fobMoeda),
    taxaCambio: num(inputRaw.taxaCambio),
    freteInternacional: num(inputRaw.freteInternacional),
    seguroInternacional: num(inputRaw.seguroInternacional),
    thc: num(inputRaw.thc),
    armazenagem: num(inputRaw.armazenagem),
    despachante: num(inputRaw.despachante),
    siscomex: num(inputRaw.siscomex),
    afrmm: num(inputRaw.afrmm),
    outrosCustos: num(inputRaw.outrosCustos),
    uf: (inputRaw.uf || "").toUpperCase(),
  };

  // Quantidade e valor unitário são informativos: o motor opera sobre o FOB
  // TOTAL (fobMoeda). Se não vierem, assume 1 item e deriva o unitário.
  const quantidade = num(inputRaw.quantidade) || 1;
  const valorUnitarioMoeda = num(inputRaw.valorUnitarioMoeda) || round2(input.fobMoeda / quantidade);

  // 1) Valor aduaneiro (CIF) = mercadoria + frete + seguro (todos em BRL).
  const fobBrl = input.fobMoeda * input.taxaCambio;
  const valorAduaneiro = fobBrl + input.freteInternacional + input.seguroInternacional;

  // 2) Alíquotas.
  const { rates: fed, encontrado } = getFederalRates(input.ncm);
  const entry = findByNcm(input.ncm);
  if (!encontrado) {
    avisos.push(
      "NCM fora da base de amostra do protótipo — aplicadas alíquotas federais padrão. Valide na fonte oficial.",
    );
  }
  const icmsRate = getIcmsRate(input.uf);
  if (!input.uf) {
    avisos.push("UF de destino não informada — ICMS estimado com alíquota padrão (18%).");
  }

  // 3) Tributos federais.
  // II incide sobre o valor aduaneiro.
  const ii = fed.ii * valorAduaneiro;
  // IPI incide sobre (valor aduaneiro + II).
  const ipi = fed.ipi * (valorAduaneiro + ii);
  // PIS e COFINS-Importação incidem sobre o valor aduaneiro.
  const pis = fed.pis * valorAduaneiro;
  const cofins = fed.cofins * valorAduaneiro;
  // CBS (fase de teste) em paralelo, sobre o valor aduaneiro (PRD §7).
  const cbs = CBS_RATE * valorAduaneiro;

  // 4) ICMS — cálculo "por dentro" (PRD §7). Base inclui Siscomex e AFRMM.
  //    CBS NÃO entra na base do ICMS (conforme descrição da seção 7 do PRD).
  const baseIcmsParcial =
    valorAduaneiro + ii + ipi + pis + cofins + input.siscomex + input.afrmm;
  const baseIcmsCheia = icmsRate < 1 ? baseIcmsParcial / (1 - icmsRate) : baseIcmsParcial;
  const icms = baseIcmsCheia * icmsRate;

  const tributos: TaxLineItem[] = [
    {
      chave: "ii",
      rotulo: "Imposto de Importação (II)",
      aliquota: fed.ii,
      base: round2(valorAduaneiro),
      valor: round2(ii),
    },
    {
      chave: "ipi",
      rotulo: "IPI — Importação",
      aliquota: fed.ipi,
      base: round2(valorAduaneiro + ii),
      valor: round2(ipi),
      observacao: "Base: valor aduaneiro + II",
    },
    {
      chave: "pis",
      rotulo: "PIS-Importação",
      aliquota: fed.pis,
      base: round2(valorAduaneiro),
      valor: round2(pis),
    },
    {
      chave: "cofins",
      rotulo: "COFINS-Importação",
      aliquota: fed.cofins,
      base: round2(valorAduaneiro),
      valor: round2(cofins),
    },
    {
      chave: "cbs",
      rotulo: "CBS (fase de teste)",
      aliquota: CBS_RATE,
      base: round2(valorAduaneiro),
      valor: round2(cbs),
      observacao: "Transição da reforma tributária (2026)",
    },
    {
      chave: "icms",
      rotulo: `ICMS — ${input.uf || "UF?"}`,
      aliquota: icmsRate,
      base: round2(baseIcmsCheia),
      valor: round2(icms),
      observacao: "Cálculo por dentro",
    },
  ];

  const totalTributos = tributos.reduce((s, t) => s + t.valor, 0);

  // 5) Custos variáveis (não entram na base dos tributos, exceto Siscomex/AFRMM já usados no ICMS).
  const custosRaw: CostLineItem[] = [
    { chave: "frete", rotulo: "Frete internacional", valor: round2(input.freteInternacional) },
    { chave: "seguro", rotulo: "Seguro internacional", valor: round2(input.seguroInternacional) },
    { chave: "siscomex", rotulo: "Taxa Siscomex", valor: round2(input.siscomex) },
    { chave: "afrmm", rotulo: "AFRMM", valor: round2(input.afrmm) },
    { chave: "thc", rotulo: "THC", valor: round2(input.thc) },
    { chave: "armazenagem", rotulo: "Armazenagem", valor: round2(input.armazenagem) },
    { chave: "despachante", rotulo: "Honorários de despachante", valor: round2(input.despachante) },
    { chave: "outros", rotulo: "Outros custos", valor: round2(input.outrosCustos) },
  ];
  // Frete/seguro já estão no valor aduaneiro; mantemos no breakdown apenas os
  // custos que NÃO compõem o VA, para o total de custos não duplicar.
  const custos = custosRaw.filter((c) => !["frete", "seguro"].includes(c.chave) && c.valor > 0);
  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);

  // 6) Landed cost = valor aduaneiro + tributos + custos (sem duplicar frete/seguro).
  const landedCost = valorAduaneiro + totalTributos + totalCustos;

  return {
    ncm: input.ncm,
    descricaoNcm: entry?.descricao,
    uf: input.uf,
    moeda: input.moeda,
    taxaCambio: input.taxaCambio,
    fobMoeda: input.fobMoeda,
    quantidade,
    valorUnitarioMoeda,
    fobBrl: round2(fobBrl),
    freteInternacional: round2(input.freteInternacional),
    seguroInternacional: round2(input.seguroInternacional),
    valorAduaneiro: round2(valorAduaneiro),
    tributos,
    totalTributos: round2(totalTributos),
    custos,
    totalCustos: round2(totalCustos),
    landedCost: round2(landedCost),
    aliquotas: {
      ii: fed.ii,
      ipi: fed.ipi,
      pis: fed.pis,
      cofins: fed.cofins,
      cbs: CBS_RATE,
      icms: icmsRate,
    },
    avisos,
  };
}
