/**
 * Resolve o ContextoCalculo a partir do banco (RNF-1, RNF-6).
 *
 * Toda a assincronia do cálculo vive aqui, deixando o motor puro e síncrono.
 * O objeto devolvido é serializável e é gravado em Importacao.contextoJson —
 * o que torna qualquer simulação antiga reproduzível exatamente, mesmo depois
 * de a base oficial ser atualizada.
 */

import { prisma } from "@/lib/db";
import { apenasDigitos } from "@/lib/ncm/codigo";
import { getRuleSet, getRuleSetPorData, RULESET_PADRAO_ID } from "./rulesets";
import type { RegimeTributario } from "./rulesets/tipos";
import { getIcmsUf, totalIcms, PIS_IMPORTACAO, COFINS_IMPORTACAO } from "./rates";
import type { Aliquota, AliquotasNcm, ContextoCalculo, CotacaoUsada } from "./types";

export interface OpcoesContexto {
  ncms: string[];
  uf: string;
  regime?: RegimeTributario;
  dataReferencia?: string;
  rulesetId?: string;
  fx?: CotacaoUsada;

  /**
   * Alíquota efetiva de ICMS declarada pelo usuário (fração, ex.: 0.04).
   *
   * Existe porque benefício estadual de importação — TTD catarinense,
   * COMEXPRODUZIR goiano, INVEST-ES — não é tabelável: depende de habilitação
   * do contribuinte e opera por diferimento e crédito presumido. Nenhuma
   * tabela acerta isso. Quem sabe é o importador, então ele informa e a
   * origem do número fica registrada como dele.
   */
  icmsManual?: number | null;
  /** Se o produto está na lista do adicional de combate à pobreza do estado. */
  fecpAplicavel?: boolean | null;
  /** Identificação do regime especial, para constar no PDF. */
  icmsObservacao?: string;
}

function desconhecida(motivo: string): Aliquota {
  return { conhecida: false, motivo };
}

export async function resolverContexto(opts: OpcoesContexto): Promise<ContextoCalculo> {
  const dataReferencia = opts.dataReferencia ?? new Date().toISOString();
  const ruleset = opts.rulesetId
    ? getRuleSet(opts.rulesetId)
    : getRuleSetPorData(dataReferencia) ?? getRuleSet(RULESET_PADRAO_ID);

  const codigos = [...new Set(opts.ncms.map((n) => apenasDigitos(n)).filter((n) => n.length === 8))];

  const [nomenclaturas, aliquotas, versaoTec, versaoTipi, versaoNom] = await Promise.all([
    prisma.ncmNomenclatura.findMany({ where: { codigo: { in: codigos } } }),
    prisma.ncmAliquota.findMany({ where: { codigo: { in: codigos }, ex: "" } }),
    prisma.baseVersao.findFirst({ where: { tipo: "tec", ativa: true } }),
    prisma.baseVersao.findFirst({ where: { tipo: "tipi", ativa: true } }),
    prisma.baseVersao.findFirst({ where: { tipo: "nomenclatura", ativa: true } }),
  ]);

  const porNomenclatura = new Map(nomenclaturas.map((n) => [n.codigo, n]));
  const porAliquota = new Map(aliquotas.map((a) => [a.codigo, a]));

  const porNcm: Record<string, AliquotasNcm> = {};
  for (const codigo of codigos) {
    const nom = porNomenclatura.get(codigo);
    const al = porAliquota.get(codigo);

    const ii: Aliquota =
      al?.ii != null
        ? {
            conhecida: true,
            valor: al.ii,
            fonte: al.origemII ?? "TEC",
            ato: versaoTec?.ato,
            vigenteEm: versaoTec?.vigenteEm,
          }
        : desconhecida("alíquota de II não encontrada na TEC carregada");

    const ipi: Aliquota = al?.ipiNT
      ? {
          conhecida: true,
          valor: 0,
          naoTributado: true,
          fonte: "TIPI",
          ato: versaoTipi?.ato,
          vigenteEm: versaoTipi?.vigenteEm,
        }
      : al?.ipi != null
        ? {
            conhecida: true,
            valor: al.ipi,
            fonte: al.origemIPI ?? "TIPI",
            ato: versaoTipi?.ato,
            vigenteEm: versaoTipi?.vigenteEm,
          }
        : desconhecida("alíquota de IPI não encontrada na TIPI carregada");

    // PIS/COFINS-Importação: alíquotas gerais da Lei 10.865/2004, salvo
    // regimes específicos (monofásicos), que a base por NCM sobrepõe quando
    // houver o dado.
    const pis: Aliquota = {
      conhecida: true,
      valor: al?.pis ?? PIS_IMPORTACAO,
      fonte: al?.pis != null ? "base por NCM" : "Lei 10.865/2004 (alíquota geral)",
    };
    const cofins: Aliquota = {
      conhecida: true,
      valor: al?.cofins ?? COFINS_IMPORTACAO,
      fonte: al?.cofins != null ? "base por NCM" : "Lei 10.865/2004 (alíquota geral)",
    };

    porNcm[codigo] = {
      ncm: codigo,
      descricaoOficial: nom?.descricao,
      caminhoOficial: nom?.caminho,
      existeNaBase: Boolean(nom),
      ii,
      ipi,
      pis,
      cofins,
    };
  }

  const uf = (opts.uf || "").toUpperCase();
  const detalheUf = await getIcmsUf(uf);
  const observacao = opts.icmsObservacao?.trim() || undefined;

  let icms: Aliquota;
  let icmsDetalhe: ContextoCalculo["icmsDetalhe"];

  if (opts.icmsManual != null && Number.isFinite(opts.icmsManual)) {
    // Declaração do usuário vence a tabela: ele conhece o próprio regime.
    icms = {
      conhecida: true,
      valor: opts.icmsManual,
      fonte: observacao
        ? `informada por você — regime especial (${observacao})`
        : "informada por você — regime especial",
      manual: true,
    };
    icmsDetalhe = {
      interna: opts.icmsManual,
      fecp: 0,
      fecpAplicado: false,
      estimativa: false,
      declarado: true,
      observacao,
    };
  } else if (!detalheUf) {
    icms = desconhecida("UF de destino não informada");
  } else {
    const fecpAplicado = opts.fecpAplicavel ?? detalheUf.fecpPadrao;
    const valor = totalIcms(detalheUf, opts.fecpAplicavel);
    icms = {
      conhecida: true,
      valor,
      fonte:
        detalheUf.fecp > 0 && fecpAplicado
          ? `${detalheUf.fonte} · inclui ${(detalheUf.fecp * 100).toLocaleString("pt-BR")}% de adicional (FECP)`
          : detalheUf.fonte,
    };
    icmsDetalhe = {
      interna: detalheUf.interna,
      fecp: detalheUf.fecp,
      fecpAplicado,
      estimativa: detalheUf.estimativa,
      declarado: false,
      observacao,
    };
  }

  return {
    rulesetId: ruleset.id,
    rulesetRotulo: ruleset.rotulo,
    dataReferencia,
    regime: opts.regime ?? "lucro_real",
    uf,
    icms,
    icmsDetalhe,
    porNcm,
    baseVersaoId: versaoNom?.id,
    baseAto: versaoNom?.ato,
    baseVigenteEm: versaoNom?.vigenteEm,
    fx: opts.fx,
  };
}
