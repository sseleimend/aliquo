// Tipos do motor de cálculo tributário e de landed cost.

import type { ChaveTributo, RegimeTributario } from "./rulesets/tipos";

export type { ChaveTributo, RegimeTributario };

/**
 * Uma alíquota ou é conhecida e rastreável até um ato oficial, ou não existe.
 *
 * Modelar "desconhecida" no tipo é o conserto central da Fase 2: antes, um NCM
 * fora da base recebia silenciosamente II 16% / IPI 0% e o resultado saía como
 * se fosse fato. Agora o motor é obrigado a lidar com a ausência.
 */
export type Aliquota =
  | {
      conhecida: true;
      valor: number;
      /** "TEC Anexo II", "TIPI", "informada pelo usuário"... */
      fonte: string;
      ato?: string;
      vigenteEm?: string;
      /** true quando o próprio usuário informou por não haver base oficial. */
      manual?: boolean;
      /** IPI "NT" — não-tributado, que é diferente de 0%. */
      naoTributado?: boolean;
    }
  | { conhecida: false; motivo: string };

export interface AliquotasNcm {
  ncm: string;
  descricaoOficial?: string;
  caminhoOficial?: string;
  existeNaBase: boolean;
  ii: Aliquota;
  ipi: Aliquota;
  pis: Aliquota;
  cofins: Aliquota;
}

export interface CotacaoUsada {
  moeda: string;
  rate: number;
  fonte: string;
  asOf?: string;
  dataRef?: string;
  stale?: boolean;
}

/**
 * Tudo que o motor precisa saber, já resolvido do banco.
 * É serializável — vira o snapshot gravado em Importacao.contextoJson (RNF-6).
 */
export interface ContextoCalculo {
  rulesetId: string;
  rulesetRotulo: string;
  dataReferencia: string;
  regime: RegimeTributario;
  uf: string;
  icms: Aliquota;
  /** Alíquotas por NCM (chave = 8 dígitos). */
  porNcm: Record<string, AliquotasNcm>;
  baseVersaoId?: string;
  baseAto?: string;
  baseVigenteEm?: string;
  fx?: CotacaoUsada;
}

export type CriterioRateio = "valor" | "peso" | "quantidade";

export interface ItemCalculo {
  ncm: string;
  descricaoProduto?: string;
  quantidade: number;
  valorUnitarioMoeda: number;
  pesoLiquidoKg?: number;
  /** Informadas pelo usuário quando não há alíquota oficial. */
  aliquotaIIManual?: number;
  aliquotaIPIManual?: number;
}

export interface CustoCalculo {
  chave: string;
  rotulo: string;
  valor: number; // BRL
  /** Frete e seguro compõem o valor aduaneiro. */
  compoeValorAduaneiro: boolean;
  /** Siscomex e AFRMM entram na base do ICMS sem compor o VA. */
  entraBaseIcms: boolean;
  criterioRateio: CriterioRateio;
}

export interface EntradaCalculo {
  itens: ItemCalculo[];
  custos: CustoCalculo[];
  moeda: string;
  taxaCambio: number;
  uf: string;
}

export interface LinhaTributo {
  chave: ChaveTributo;
  rotulo: string;
  aliquota: number;
  base: number;
  valor: number;
  esfera: "federal" | "estadual";
  creditavel: boolean;
  fonteLegal: string;
  fonteAliquota: string;
  observacao?: string;
}

export interface LinhaCusto {
  chave: string;
  rotulo: string;
  valor: number;
  criterioRateio?: CriterioRateio;
}

export interface Bloqueio {
  item?: number;
  ncm?: string;
  campo: string;
  mensagem: string;
  /** O usuário pode destravar informando o valor manualmente. */
  permiteEntradaManual: boolean;
}

export interface ResultadoItem {
  ordem: number;
  ncm: string;
  descricaoOficial?: string;
  caminhoOficial?: string;
  descricaoProduto?: string;

  quantidade: number;
  valorUnitarioMoeda: number;
  fobMoeda: number;
  fobBrl: number;

  freteRateado: number;
  seguroRateado: number;
  outrosVaRateado: number;
  valorAduaneiro: number;
  despesasAduaneirasRateadas: number;

  tributos: LinhaTributo[];
  totalTributos: number;

  custosRateados: LinhaCusto[];
  totalCustos: number;

  landedCost: number;
  landedCostEfetivo: number;

  bloqueios: Bloqueio[];
}

export interface ResultadoCalculo {
  rulesetId: string;
  rulesetRotulo: string;
  dataReferencia: string;
  regime: RegimeTributario;
  uf: string;
  moeda: string;
  taxaCambio: number;
  fx?: CotacaoUsada;

  baseAto?: string;
  baseVigenteEm?: string;

  itens: ResultadoItem[];

  fobBrlTotal: number;
  valorAduaneiroTotal: number;
  totalTributos: number;
  totalCustos: number;
  landedCost: number;
  /** Após créditos recuperáveis no regime informado (RF-B3). */
  landedCostEfetivo: number;
  creditosRecuperaveis: Array<{ chave: ChaveTributo; rotulo: string; valor: number }>;

  /** Consolidado por tributo, somando os itens. */
  totaisPorTributo: Array<{ chave: ChaveTributo; rotulo: string; valor: number }>;

  avisos: string[];
  bloqueios: Bloqueio[];
  /** true = falta alíquota oficial em algum item; não é um custo confiável. */
  provisorio: boolean;
}
