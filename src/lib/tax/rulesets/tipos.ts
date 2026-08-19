/**
 * Tipos do motor tributário configurável (RF-B1).
 *
 * A divisão que sustenta tudo:
 *
 *   ESTRUTURA (quais tributos existem, sobre o que incidem, em que ordem)
 *     -> módulos TypeScript versionados, aqui em rulesets/. Muda raramente,
 *        precisa de revisão e teste, e o histórico no git é a auditoria.
 *
 *   NÚMEROS (alíquotas por NCM, por UF, por regime)
 *     -> banco, alimentado pelas bases oficiais. Muda toda hora e não pode
 *        exigir deploy.
 *
 * Colocar fórmula em banco (um interpretador de expressão) seria intestável e
 * uma superfície de risco sem ganho. Colocar alíquota em código foi exatamente
 * o que produziu os números fictícios da Fase 1.
 */

export type ChaveTributo = "ii" | "ipi" | "pis" | "cofins" | "cbs" | "ibs" | "icms";

export type RegimeTributario = "lucro_real" | "lucro_presumido" | "simples_nacional";

/** Componentes que podem entrar numa base de cálculo. */
export type ComponenteBase = ChaveTributo | "valorAduaneiro" | "despesasAduaneiras";

export type EspecBase =
  | { tipo: "valorAduaneiro" }
  | { tipo: "soma"; componentes: ComponenteBase[] };

export type EspecAliquota =
  | { tipo: "porNcm"; campo: "ii" | "ipi" | "pis" | "cofins" }
  | { tipo: "porUf" }
  | { tipo: "fixa"; valor: number };

export interface ContextoRegra {
  regime: RegimeTributario;
  uf: string;
  dataReferencia: string;
}

export interface RegraTributo {
  chave: ChaveTributo;
  rotulo: string;
  esfera: "federal" | "estadual";
  /** Ordem de aplicação — importa porque bases referenciam tributos anteriores. */
  ordem: number;
  base: EspecBase;
  aliquota: EspecAliquota;
  /**
   * Cálculo "por dentro": o tributo integra a própria base.
   * base_cheia = base_parcial / (1 - alíquota)
   */
  porDentro?: boolean;
  /** Fator de transição da reforma (RF-B2): 0.9, 0.8... 1 = integral. */
  fatorTransicao?: number;
  /** Referência legal exibida na tela e no PDF (RNF-1). */
  fonteLegal: string;
  observacao?: string;
  aplicavel?: (ctx: ContextoRegra) => boolean;
  /** Recuperável como crédito? Muda o custo EFETIVO por regime (RF-B3). */
  creditavel?: (ctx: ContextoRegra) => boolean;
}

export interface RuleSet {
  id: string; // "br-import-2026.01"
  rotulo: string;
  vigenciaInicio: string; // ISO
  vigenciaFim: string | null;
  tributos: RegraTributo[];
}
