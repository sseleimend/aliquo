// Tipos do motor de cálculo tributário.

export interface TaxInput {
  /** NCM confirmado pelo usuário (RF06). */
  ncm: string;
  /** Valor da mercadoria (FOB) na moeda estrangeira — TOTAL (unitário × quantidade). */
  fobMoeda: number;
  /** Quantidade de itens importados. Opcional (default 1). */
  quantidade?: number;
  /** Valor unitário (FOB) na moeda estrangeira. Opcional (informativo). */
  valorUnitarioMoeda?: number;
  /** Moeda estrangeira (USD, EUR, CNY...). */
  moeda: string;
  /** Taxa de câmbio para BRL (1 unidade da moeda = X BRL). */
  taxaCambio: number;
  /** UF de destino da importação (RF07) — define a alíquota de ICMS. */
  uf: string;

  // Compõem o valor aduaneiro (base CIF):
  freteInternacional: number; // BRL
  seguroInternacional: number; // BRL

  // Custos variáveis informados manualmente (RF09):
  thc: number;
  armazenagem: number;
  despachante: number;
  siscomex: number;
  afrmm: number;
  outrosCustos: number;
}

export interface TaxLineItem {
  chave: "ii" | "ipi" | "pis" | "cofins" | "cbs" | "icms";
  rotulo: string;
  /** Alíquota em fração (ex.: 0.16). */
  aliquota: number;
  /** Base de cálculo em BRL. */
  base: number;
  /** Valor do tributo em BRL. */
  valor: number;
  observacao?: string;
}

export interface CostLineItem {
  chave: string;
  rotulo: string;
  valor: number;
}

export interface TaxResult {
  ncm: string;
  descricaoNcm?: string;
  uf: string;
  moeda: string;
  taxaCambio: number;

  fobMoeda: number;
  quantidade: number;
  valorUnitarioMoeda: number;
  fobBrl: number;
  freteInternacional: number;
  seguroInternacional: number;
  valorAduaneiro: number;

  tributos: TaxLineItem[];
  totalTributos: number;

  custos: CostLineItem[];
  totalCustos: number;

  landedCost: number;

  aliquotas: {
    ii: number;
    ipi: number;
    pis: number;
    cofins: number;
    cbs: number;
    icms: number;
  };

  /** Avisos (ex.: NCM fora da base de amostra → alíquotas padrão). */
  avisos: string[];
}
