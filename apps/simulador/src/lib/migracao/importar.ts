/**
 * Importa embarques históricos para o histórico do usuário (semente do hub).
 *
 * Decisão que define o significado do registro importado: os tributos são
 * RECALCULADOS com as alíquotas oficiais vigentes hoje, e não copiados do
 * sistema de origem. Copiar um número que não podemos justificar contra uma
 * fonte oficial seria exatamente o que a Fase 2 existe para eliminar.
 *
 * O custo que a ferramenta anterior apurou, quando informado, é guardado como
 * REFERÊNCIA ao lado — nunca misturado com o nosso cálculo.
 */

import { prisma } from "@/lib/db";
import { getCotacao, CambioIndisponivelError } from "@/lib/fx";
import { resolverContexto } from "@/lib/tax/contexto";
import { calcular } from "@/lib/tax/engine";
import type { CustoCalculo, EntradaCalculo, RegimeTributario } from "@/lib/tax/types";
import type { EmbarqueImportado } from "./template";

export interface ResultadoImportacao {
  criadas: Array<{ id: string; referencia: string; landedCost: number; provisorio: boolean }>;
  falhas: Array<{ referencia: string; motivo: string }>;
}

function montarCustos(e: EmbarqueImportado): CustoCalculo[] {
  const c = e.criterioRateio;
  return [
    { chave: "frete", rotulo: "Frete internacional", valor: e.frete, compoeValorAduaneiro: true, entraBaseIcms: false, criterioRateio: c },
    { chave: "seguro", rotulo: "Seguro internacional", valor: e.seguro, compoeValorAduaneiro: true, entraBaseIcms: false, criterioRateio: c },
    { chave: "siscomex", rotulo: "Taxa Siscomex", valor: e.siscomex, compoeValorAduaneiro: false, entraBaseIcms: true, criterioRateio: c },
    { chave: "afrmm", rotulo: "AFRMM", valor: e.afrmm, compoeValorAduaneiro: false, entraBaseIcms: true, criterioRateio: c },
    { chave: "thc", rotulo: "THC", valor: e.thc, compoeValorAduaneiro: false, entraBaseIcms: false, criterioRateio: c },
    { chave: "armazenagem", rotulo: "Armazenagem", valor: e.armazenagem, compoeValorAduaneiro: false, entraBaseIcms: false, criterioRateio: c },
    { chave: "despachante", rotulo: "Honorários de despachante", valor: e.despachante, compoeValorAduaneiro: false, entraBaseIcms: false, criterioRateio: c },
    { chave: "outros", rotulo: "Outros custos", valor: e.outros, compoeValorAduaneiro: false, entraBaseIcms: false, criterioRateio: c },
  ].filter((x) => x.valor > 0);
}

export async function importarEmbarques(
  userId: string,
  embarques: EmbarqueImportado[],
): Promise<ResultadoImportacao> {
  const criadas: ResultadoImportacao["criadas"] = [];
  const falhas: ResultadoImportacao["falhas"] = [];

  for (const e of embarques) {
    try {
      // A taxa da operação original é respeitada quando informada; só buscamos
      // câmbio quando a planilha não traz, porque impor a cotação de hoje a um
      // embarque antigo distorceria o valor aduaneiro.
      let taxa = e.taxaCambio;
      let fonteFx = "informada na planilha";
      let dataRefFx: string | undefined;

      if (!taxa || taxa <= 0) {
        try {
          const c = await getCotacao({ moeda: e.moeda, finalidade: "fiscal" });
          taxa = c.rate;
          fonteFx = c.fonteRotulo;
          dataRefFx = c.dataRef;
        } catch (err) {
          if (err instanceof CambioIndisponivelError) {
            falhas.push({
              referencia: e.referencia,
              motivo: `Sem taxa de câmbio na planilha e nenhuma cotação de ${e.moeda} disponível.`,
            });
            continue;
          }
          throw err;
        }
      }

      const ctx = await resolverContexto({
        ncms: e.itens.map((i) => i.ncm),
        uf: e.uf,
        regime: e.regime as RegimeTributario,
        fx: { moeda: e.moeda, rate: taxa, fonte: fonteFx, dataRef: dataRefFx },
      });

      const entrada: EntradaCalculo = {
        moeda: e.moeda,
        taxaCambio: taxa,
        uf: e.uf,
        itens: e.itens.map((i) => ({
          ncm: i.ncm,
          descricaoProduto: i.descricao,
          quantidade: i.quantidade,
          valorUnitarioMoeda: i.valorUnitario,
          pesoLiquidoKg: i.pesoLiquidoKg,
        })),
        custos: montarCustos(e),
      };

      const resultado = calcular(entrada, ctx);
      resultado.avisos.push(
        "Registro migrado de outra ferramenta. Os tributos foram recalculados com as " +
          "alíquotas oficiais vigentes hoje — podem diferir do que foi pago na operação original.",
      );

      const registro = await prisma.importacao.create({
        data: {
          userId,
          apelido: e.referencia,
          // `arquivada` distingue histórico migrado de simulação feita aqui:
          // o número é nosso, mas a operação não foi.
          status: "arquivada",
          uf: e.uf,
          moeda: e.moeda,
          incoterm: e.incoterm,
          regimeTributario: e.regime,
          dataReferencia: e.data ? new Date(`${e.data}T12:00:00.000Z`) : new Date(),
          rulesetId: resultado.rulesetId,
          baseVersaoId: ctx.baseVersaoId ?? null,
          fxRate: taxa,
          fxFonte: fonteFx,
          fxDataRef: dataRefFx ?? null,
          contextoJson: JSON.stringify(ctx),
          inputJson: JSON.stringify(entrada),
          resultadoJson: JSON.stringify(resultado),
          landedCost: resultado.landedCost,
          landedCostEfetivo: resultado.landedCostEfetivo,
          provisorio: resultado.provisorio,
          itens: {
            create: e.itens.map((i, idx) => {
              const r = resultado.itens[idx];
              return {
                ordem: idx,
                ncm: i.ncm,
                ncmDescricaoOficial: r?.descricaoOficial ?? null,
                ncmCaminhoOficial: r?.caminhoOficial ?? null,
                descricaoProduto: i.descricao ?? null,
                quantidade: i.quantidade,
                valorUnitarioMoeda: i.valorUnitario,
                pesoLiquidoKg: i.pesoLiquidoKg ?? null,
                ncmFonte: "reuso",
                ncmConfirmadoEm: new Date(),
                resultadoJson: r ? JSON.stringify(r) : null,
                landedCost: r?.landedCost ?? null,
              };
            }),
          },
          custos: { create: montarCustos(e) },
        },
        select: { id: true },
      });

      criadas.push({
        id: registro.id,
        referencia: e.referencia,
        landedCost: resultado.landedCost,
        provisorio: resultado.provisorio,
      });
    } catch (err) {
      falhas.push({
        referencia: e.referencia,
        motivo: err instanceof Error ? err.message : "Erro inesperado ao importar.",
      });
    }
  }

  return { criadas, falhas };
}
