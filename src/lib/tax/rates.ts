/**
 * Alíquotas que NÃO vêm da TEC/TIPI.
 *
 * O que sumiu daqui na Fase 2 é a parte importante: `DEFAULT_FEDERAL_RATES`
 * (II 16% / IPI 0%) era aplicado silenciosamente a qualquer NCM fora da base
 * de amostra e foi a causa direta dos resultados fictícios. Não existe mais
 * alíquota federal padrão: ou o número vem da base oficial, ou o motor bloqueia.
 *
 * Sobrou o ICMS, que é estadual e não está na TEC/TIPI, e as alíquotas gerais
 * de PIS/COFINS-Importação, que são fixadas em lei e não por NCM.
 */

import { prisma } from "@/lib/db";

/** Lei 10.865/2004, art. 8º — alíquotas gerais na importação. */
export const PIS_IMPORTACAO = 0.021;
export const COFINS_IMPORTACAO = 0.0965;

export const FONTE_ICMS = "tabela interna por UF (estimativa — confirmar na SEFAZ do estado)";

/**
 * ICMS por UF.
 *
 * ATENÇÃO: são alíquotas gerais aproximadas. Não capturam benefícios estaduais
 * de importação (TTD/SC, regimes de GO, ES etc.), que mudam a alíquota efetiva
 * em mais de 10 pontos. É o ponto do cálculo com maior margem de erro — está
 * sinalizado na UI e no PDF.
 */
export const ICMS_POR_UF: Record<string, number> = {
  AC: 0.19, AL: 0.19, AM: 0.2, AP: 0.18, BA: 0.205, CE: 0.2, DF: 0.2,
  ES: 0.17, GO: 0.19, MA: 0.22, MG: 0.18, MS: 0.17, MT: 0.17, PA: 0.19,
  PB: 0.2, PE: 0.205, PI: 0.21, PR: 0.195, RJ: 0.22, RN: 0.18, RO: 0.195,
  RR: 0.2, RS: 0.17, SC: 0.17, SE: 0.19, SP: 0.18, TO: 0.2,
};

/**
 * Alíquota de ICMS vigente para a UF.
 * Consulta a tabela versionada em banco quando houver; cai na tabela interna
 * caso contrário.
 */
export async function getIcmsRate(uf: string): Promise<number> {
  const sigla = (uf || "").toUpperCase();
  if (!sigla) return 0;

  try {
    const agora = new Date();
    const linha = await prisma.aliquotaUf.findFirst({
      where: {
        uf: sigla,
        vigenciaIni: { lte: agora },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: agora } }],
      },
      orderBy: { vigenciaIni: "desc" },
    });
    if (linha) return linha.aliquota + linha.fecp;
  } catch {
    // Tabela ainda não populada — segue com a estimativa interna.
  }

  return ICMS_POR_UF[sigla] ?? 0.18;
}

/** Versão síncrona, para testes e para o cliente. */
export function getIcmsRateSync(uf: string): number {
  const sigla = (uf || "").toUpperCase();
  if (!sigla) return 0;
  return ICMS_POR_UF[sigla] ?? 0.18;
}
