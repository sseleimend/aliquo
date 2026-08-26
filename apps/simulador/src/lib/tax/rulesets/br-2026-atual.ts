import type { RuleSet } from "./tipos";

/**
 * Conjunto de regras vigente no modelo atual (pré-reforma), com a CBS já em
 * fase de teste em 2026.
 *
 * Cada regra declara sua base, sua alíquota e a fonte legal. A ordem importa:
 * o IPI usa o II na base, e o ICMS usa quase todos os anteriores.
 *
 * Creditabilidade (RF-B3): o que muda de verdade entre regimes não é a
 * alíquota paga na nacionalização, é o que volta como crédito. Um importador
 * do Simples paga o mesmo e recupera quase nada — o custo EFETIVO dele é
 * muito maior, e é isso que o simulador precisa mostrar.
 */
export const BR_2026_ATUAL: RuleSet = {
  id: "br-import-2026.01",
  rotulo: "Importação — modelo atual (com CBS em teste)",
  vigenciaInicio: "2026-01-01",
  vigenciaFim: "2026-12-31",
  tributos: [
    {
      chave: "ii",
      rotulo: "Imposto de Importação (II)",
      esfera: "federal",
      ordem: 10,
      base: { tipo: "valorAduaneiro" },
      aliquota: { tipo: "porNcm", campo: "ii" },
      fonteLegal: "Decreto-Lei 37/1966; TEC — Resolução Gecex nº 272/2021",
      // II não é recuperável em nenhum regime: é custo de aquisição.
      creditavel: () => false,
    },
    {
      chave: "ipi",
      rotulo: "IPI — Importação",
      esfera: "federal",
      ordem: 20,
      base: { tipo: "soma", componentes: ["valorAduaneiro", "ii"] },
      aliquota: { tipo: "porNcm", campo: "ipi" },
      observacao: "Base: valor aduaneiro + II",
      fonteLegal: "Lei 4.502/1964, art. 14; TIPI — Decreto 11.158/2022",
      creditavel: (ctx) => ctx.regime !== "simples_nacional",
    },
    {
      chave: "pis",
      rotulo: "PIS-Importação",
      esfera: "federal",
      ordem: 30,
      base: { tipo: "valorAduaneiro" },
      aliquota: { tipo: "porNcm", campo: "pis" },
      fonteLegal: "Lei 10.865/2004, art. 7º",
      creditavel: (ctx) => ctx.regime === "lucro_real",
    },
    {
      chave: "cofins",
      rotulo: "COFINS-Importação",
      esfera: "federal",
      ordem: 40,
      base: { tipo: "valorAduaneiro" },
      aliquota: { tipo: "porNcm", campo: "cofins" },
      fonteLegal: "Lei 10.865/2004, art. 7º",
      creditavel: (ctx) => ctx.regime === "lucro_real",
    },
    {
      chave: "cbs",
      rotulo: "CBS (fase de teste)",
      esfera: "federal",
      ordem: 50,
      base: { tipo: "valorAduaneiro" },
      aliquota: { tipo: "fixa", valor: 0.009 },
      observacao: "Transição da reforma tributária — alíquota de teste em 2026",
      fonteLegal: "EC 132/2023; LC 214/2025 (fase de teste)",
      creditavel: (ctx) => ctx.regime !== "simples_nacional",
    },
    {
      chave: "icms",
      rotulo: "ICMS — Importação",
      esfera: "estadual",
      ordem: 60,
      // A CBS de teste NÃO integra a base do ICMS.
      base: {
        tipo: "soma",
        componentes: ["valorAduaneiro", "ii", "ipi", "pis", "cofins", "despesasAduaneiras"],
      },
      aliquota: { tipo: "porUf" },
      porDentro: true,
      observacao: "Cálculo por dentro — o imposto integra a própria base",
      fonteLegal: "LC 87/1996, art. 13, V e §1º",
      creditavel: (ctx) => ctx.regime !== "simples_nacional",
    },
  ],
};
