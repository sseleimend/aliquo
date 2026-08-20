import { formatBRL } from "@/lib/format";

/**
 * Indicadores do topo do histórico.
 *
 * Vive fora da página porque o que está aqui não é aritmética, é uma decisão de
 * produto: **o número grande tem que ser defensável**. Simulação provisória é
 * aquela em que faltou alíquota oficial e cujo total o próprio app declara não
 * confiável — somá-la ao acumulado produzia um destaque que ninguém consegue
 * justificar, com a ressalva a duas tiras de distância.
 *
 * Ela sai da soma. Mas não some: o valor excluído é dito na legenda, senão o
 * acumulado deixa de bater com a tabela logo abaixo e vira outro tipo de
 * mentira.
 */

export interface ImportacaoResumida {
  landedCost: number;
  provisorio: boolean;
}

export interface Indicadores {
  /** Quantas importações existem, conferidas ou não. */
  total: number;
  conferidas: number;
  provisorias: number;
  /** Soma dos landed costs — SÓ das conferidas. */
  custoAcumulado: number;
  /** Soma do que ficou de fora, para poder ser dito. */
  custoProvisorio: number;
  /** Legenda do acumulado: explica a exclusão, ou apenas conta. */
  notaCusto: string;
  /** Legenda do contador de provisórias. */
  notaProvisorias: string;
  /** Pinta o contador de provisórias como pendência. */
  alerta: boolean;
}

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

export function calcularIndicadores(importacoes: ImportacaoResumida[]): Indicadores {
  const provisorias = importacoes.filter((i) => i.provisorio);
  const conferidas = importacoes.filter((i) => !i.provisorio);

  const soma = (lista: ImportacaoResumida[]) =>
    lista.reduce((s, i) => s + (Number.isFinite(i.landedCost) ? i.landedCost : 0), 0);

  const custoAcumulado = soma(conferidas);
  const custoProvisorio = soma(provisorias);

  return {
    total: importacoes.length,
    conferidas: conferidas.length,
    provisorias: provisorias.length,
    custoAcumulado,
    custoProvisorio,
    notaCusto:
      provisorias.length > 0
        ? `só as conferidas · ${formatBRL(custoProvisorio)} em provisórias fora da conta`
        : `${conferidas.length} ${plural(conferidas.length, "importação", "importações")}`,
    notaProvisorias: provisorias.length > 0 ? "faltam alíquotas oficiais" : "todas conferidas",
    alerta: provisorias.length > 0,
  };
}
