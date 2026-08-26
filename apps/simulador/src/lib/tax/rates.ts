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

/**
 * Alíquota de ICMS resolvida para uma UF.
 *
 * `interna` e `fecp` andam separados de propósito. O adicional de combate à
 * pobreza incide sobre listas de produtos definidas por cada estado — somar
 * cegamente cobra a mais de quem está fora da lista, e a diferença é de
 * pontos inteiros, não de centavos.
 */
export interface IcmsUf {
  /** Alíquota interna geral, sem adicional. */
  interna: number;
  /** Adicional de combate à pobreza (FECP/FECOEP/FUNPOBREZA...). */
  fecp: number;
  /**
   * Se o estado aplica o adicional de forma geral (com exceções) — caso em
   * que ele entra por padrão — ou só sobre lista restrita, caso em que só
   * entra se o usuário confirmar que o produto está nela.
   */
  fecpPadrao: boolean;
  fonte: string;
  /** true enquanto o número não vier de fonte oficial carregada. */
  estimativa: boolean;
}

export const FONTE_ICMS_ESTIMADA = "tabela interna por UF (estimativa — confirmar na SEFAZ)";

/**
 * ICMS por UF — ESTIMATIVA.
 *
 * ATENÇÃO, e a ressalva é grande: são alíquotas gerais aproximadas, sem ato
 * legal associado. Não existe tabela oficial consolidada dos 27 estados — cada
 * um fixa a sua no próprio RICMS —, então esta tabela é um ponto de partida
 * para não travar o cálculo, não uma fonte.
 *
 * Ela também NÃO captura benefício estadual de importação (TTD de Santa
 * Catarina, COMEXPRODUZIR de Goiás, INVEST-ES...), que altera a carga efetiva
 * em mais de dez pontos e depende de habilitação do contribuinte. Para esses
 * casos o usuário declara a alíquota efetiva e ela entra como informação dele.
 *
 * Substitua carregando a tabela real: `npx tsx scripts/importar-aliquotas-uf.ts`.
 */
export const ICMS_POR_UF: Record<string, Omit<IcmsUf, "fonte" | "estimativa">> = {
  AC: { interna: 0.19, fecp: 0, fecpPadrao: false },
  AL: { interna: 0.19, fecp: 0, fecpPadrao: false },
  AM: { interna: 0.2, fecp: 0, fecpPadrao: false },
  AP: { interna: 0.18, fecp: 0, fecpPadrao: false },
  BA: { interna: 0.205, fecp: 0, fecpPadrao: false },
  CE: { interna: 0.2, fecp: 0, fecpPadrao: false },
  DF: { interna: 0.2, fecp: 0, fecpPadrao: false },
  ES: { interna: 0.17, fecp: 0, fecpPadrao: false },
  GO: { interna: 0.19, fecp: 0, fecpPadrao: false },
  MA: { interna: 0.22, fecp: 0, fecpPadrao: false },
  MG: { interna: 0.18, fecp: 0, fecpPadrao: false },
  MS: { interna: 0.17, fecp: 0, fecpPadrao: false },
  MT: { interna: 0.17, fecp: 0, fecpPadrao: false },
  PA: { interna: 0.19, fecp: 0, fecpPadrao: false },
  PB: { interna: 0.2, fecp: 0, fecpPadrao: false },
  PE: { interna: 0.205, fecp: 0, fecpPadrao: false },
  PI: { interna: 0.21, fecp: 0, fecpPadrao: false },
  // O total de 19,5% que a tabela trazia é 19% + 0,5% de FECOP.
  PR: { interna: 0.19, fecp: 0.005, fecpPadrao: true },
  // SEFAZ-RJ publica 20% de alíquota interna geral + 2% de FECP.
  RJ: { interna: 0.2, fecp: 0.02, fecpPadrao: true },
  RN: { interna: 0.18, fecp: 0, fecpPadrao: false },
  RO: { interna: 0.195, fecp: 0, fecpPadrao: false },
  RR: { interna: 0.2, fecp: 0, fecpPadrao: false },
  RS: { interna: 0.17, fecp: 0, fecpPadrao: false },
  SC: { interna: 0.17, fecp: 0, fecpPadrao: false },
  SE: { interna: 0.19, fecp: 0, fecpPadrao: false },
  SP: { interna: 0.18, fecp: 0, fecpPadrao: false },
  TO: { interna: 0.2, fecp: 0, fecpPadrao: false },
};

const PADRAO: Omit<IcmsUf, "fonte" | "estimativa"> = {
  interna: 0.18,
  fecp: 0,
  fecpPadrao: false,
};

/**
 * ICMS vigente para a UF.
 *
 * Consulta a tabela versionada em banco quando houver — é ela que recebe o
 * dado oficial — e cai na estimativa interna caso contrário.
 */
export async function getIcmsUf(uf: string): Promise<IcmsUf | null> {
  const sigla = (uf || "").toUpperCase();
  if (!sigla) return null;

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
    if (linha) {
      const estimativa = /estimativa/i.test(linha.fonte);
      return {
        interna: linha.aliquota,
        fecp: linha.fecp,
        fecpPadrao: linha.fecpPadrao,
        fonte: linha.fonte,
        estimativa,
      };
    }
  } catch {
    // Tabela ainda não populada — segue com a estimativa interna.
  }

  return { ...(ICMS_POR_UF[sigla] ?? PADRAO), fonte: FONTE_ICMS_ESTIMADA, estimativa: true };
}

/** Versão síncrona, para testes e para o cliente. */
export function getIcmsUfSync(uf: string): IcmsUf | null {
  const sigla = (uf || "").toUpperCase();
  if (!sigla) return null;
  return { ...(ICMS_POR_UF[sigla] ?? PADRAO), fonte: FONTE_ICMS_ESTIMADA, estimativa: true };
}

/**
 * Alíquota total a aplicar: interna mais o adicional, quando ele incide.
 *
 * `fecpAplicavel` vindo do usuário sobrepõe o padrão da UF — é ele quem sabe
 * se o produto está na lista do estado.
 */
export function totalIcms(icms: IcmsUf, fecpAplicavel?: boolean | null): number {
  const aplica = fecpAplicavel ?? icms.fecpPadrao;
  return icms.interna + (aplica ? icms.fecp : 0);
}
