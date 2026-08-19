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
import { getIcmsRate, PIS_IMPORTACAO, COFINS_IMPORTACAO, FONTE_ICMS } from "./rates";
import type { Aliquota, AliquotasNcm, ContextoCalculo, CotacaoUsada } from "./types";

export interface OpcoesContexto {
  ncms: string[];
  uf: string;
  regime?: RegimeTributario;
  dataReferencia?: string;
  rulesetId?: string;
  fx?: CotacaoUsada;
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
  const icmsRate = await getIcmsRate(uf);
  const icms: Aliquota = uf
    ? { conhecida: true, valor: icmsRate, fonte: FONTE_ICMS }
    : desconhecida("UF de destino não informada");

  return {
    rulesetId: ruleset.id,
    rulesetRotulo: ruleset.rotulo,
    dataReferencia,
    regime: opts.regime ?? "lucro_real",
    uf,
    icms,
    porNcm,
    baseVersaoId: versaoNom?.id,
    baseAto: versaoNom?.ato,
    baseVigenteEm: versaoNom?.vigenteEm,
    fx: opts.fx,
  };
}
