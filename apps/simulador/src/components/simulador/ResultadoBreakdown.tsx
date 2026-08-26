"use client";

import { formatBRL, formatData, formatMoeda, formatPct, formatTaxa } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import type { ResultadoCalculo } from "@/lib/tax/types";

/**
 * O resultado é o documento que o produto entrega.
 *
 * Cada linha de tributo carrega alíquota, base, valor, a FONTE da alíquota e o
 * fundamento legal — rastreabilidade não é rodapé, é parte da tabela. O número
 * grande vai em monoespaçada porque existe para ser conferido, e sai carimbado
 * quando alguma alíquota falta.
 */
export function ResultadoBreakdown({
  resultado,
  importacaoId,
}: {
  resultado: ResultadoCalculo;
  importacaoId?: string | null;
}) {
  const prov = resultado.provisorio;
  const temCredito = !prov && resultado.creditosRecuperaveis.length > 0;

  return (
    <div className="space-y-5">
      {/* ---- Cabeçalho do documento ---- */}
      <div
        className={`rounded border ${
          prov ? "border-carimbo-fio bg-carimbo-fraca" : "border-fio2 bg-papel2"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
          <div>
            <p className="secao">Custo total de nacionalização</p>
            <p
              className={`mt-1.5 font-mono text-[34px] font-medium leading-none tracking-tight ${
                prov ? "text-carimbo" : "text-tinta"
              }`}
            >
              {formatBRL(resultado.landedCost)}
            </p>
          </div>

          {!prov && resultado.creditosRecuperaveis.length > 0 && (
            <div className="text-right">
              <p className="secao">Custo efetivo</p>
              <p className="mt-1.5 font-mono text-[19px] font-medium leading-none text-visto">
                {formatBRL(resultado.landedCostEfetivo)}
              </p>
              <p className="mt-1 text-[11px] text-fraco">
                após créditos · {resultado.regime.replace(/_/g, " ")}
              </p>
              {/* Crédito não é dinheiro: é o direito de abater de um imposto
                  devido na saída. Quem exporta, vende com isenção ou revende
                  para outro estado (4% pela Res. Senado 13/2012, contra os
                  17–22% creditados na entrada) acumula saldo em vez de
                  reduzir custo — e para essa pessoa o efetivo é otimista. */}
              <p className="mt-0.5 text-[11px] text-fraco">
                assume aproveitamento integral
              </p>
            </div>
          )}
        </div>

        {prov && (
          <p className="border-t border-carimbo-fio px-5 py-2.5 text-[12.5px] font-semibold text-carimbo">
            SIMULAÇÃO PROVISÓRIA — falta alíquota oficial. Este valor ainda não é confiável.
          </p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-fio px-5 py-2 text-[11.5px] text-tinta2">
          <span>
            {resultado.itens.length} {resultado.itens.length === 1 ? "item" : "itens"}
          </span>
          <span>UF {resultado.uf || "?"}</span>
          <span>
            1 {resultado.moeda} ={" "}
            <span className="font-mono">{formatTaxa(resultado.taxaCambio)}</span>
          </span>
        </div>
      </div>

      {/* ---- Pendências ---- */}
      {resultado.bloqueios.length > 0 && (
        <div className="painel border-carimbo-fio">
          <div className="painel-titulo border-b-carimbo-fio">
            <h3 className="font-serifa text-[15px] font-semibold text-carimbo">
              Pendências que travam o cálculo
            </h3>
          </div>
          <ul className="painel-corpo space-y-1.5 text-[13px] text-tinta">
            {resultado.bloqueios.map((b, i) => (
              <li key={`${b.campo}-${i}`} className="flex gap-2">
                <span className="text-carimbo">—</span>
                <span>
                  {b.item != null && <strong className="font-medium">Item {b.item + 1}: </strong>}
                  {b.mensagem}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Itens ---- */}
      {resultado.itens.map((item) => (
        <div key={`${item.ordem}-${item.ncm}`} className="painel">
          <div className="painel-titulo">
            <div className="min-w-0">
              <span className="font-mono text-[15px] font-semibold tracking-tight text-tinta">
                {formatarNcm(item.ncm)}
              </span>
              {item.descricaoProduto && (
                <span className="ml-2 text-[13px] text-tinta2">{item.descricaoProduto}</span>
              )}
            </div>
            {resultado.itens.length > 1 && (
              <span className="selo-neutro shrink-0">item {item.ordem + 1}</span>
            )}
          </div>

          {item.caminhoOficial && (
            <p className="border-b border-fio bg-papel2/60 px-5 py-2.5 text-[11.5px] leading-relaxed text-tinta2">
              <span className="secao">Texto oficial</span>
              <br />
              {item.caminhoOficial}
            </p>
          )}

          <dl className="border-b border-fio px-5 py-3 text-[13px]">
            <Linha
              rotulo={`FOB · ${formatMoeda(item.fobMoeda, resultado.moeda)} × ${formatTaxa(resultado.taxaCambio)}`}
              valor={item.fobBrl}
            />
            {item.freteRateado > 0 && (
              <Linha rotulo="Frete internacional" valor={item.freteRateado} />
            )}
            {item.seguroRateado > 0 && (
              <Linha rotulo="Seguro internacional" valor={item.seguroRateado} />
            )}
            <Linha rotulo="Valor aduaneiro" valor={item.valorAduaneiro} forte />
          </dl>

          <div className="overflow-x-auto">
            <table className="tabela min-w-[620px]">
              <thead>
                <tr>
                  <th>Tributo</th>
                  <th className="w-[92px] text-right">Alíquota</th>
                  <th className="w-[130px] text-right">Base</th>
                  <th className="w-[130px] text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {item.tributos.map((t) => (
                  <tr key={t.chave}>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-tinta">{t.rotulo}</span>
                        {t.creditavel && <span className="selo-visto">recuperável</span>}
                      </div>
                      {t.observacao && (
                        <div className="mt-0.5 text-[11.5px] text-fraco">{t.observacao}</div>
                      )}
                      <div className="mt-1 text-[11px] leading-snug text-fraco">
                        {t.fonteAliquota}
                        <span className="mx-1 text-fio2">·</span>
                        {t.fonteLegal}
                      </div>
                    </td>
                    <td className="text-right font-mono text-tinta">{formatPct(t.aliquota)}</td>
                    <td className="text-right font-mono text-fraco">{formatBRL(t.base)}</td>
                    <td className="text-right font-mono font-medium text-tinta">
                      {formatBRL(t.valor)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-papel2/60">
                  <td className="font-medium text-tinta" colSpan={3}>
                    Total de tributos
                  </td>
                  <td className="text-right font-mono font-semibold text-tinta">
                    {formatBRL(item.totalTributos)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {item.custosRateados.length > 0 && (
            <dl className="border-t border-fio px-5 py-3 text-[13px]">
              {item.custosRateados.map((c) => (
                <Linha
                  key={c.chave}
                  rotulo={c.rotulo + (c.criterioRateio ? ` · rateio por ${c.criterioRateio}` : "")}
                  valor={c.valor}
                />
              ))}
              <Linha rotulo="Total de custos" valor={item.totalCustos} forte />
            </dl>
          )}

          <p className="border-t border-fio2 px-5 py-3 text-right text-[13px]">
            <span className="secao mr-2">Landed cost do item</span>
            <span className="font-mono text-[15px] font-semibold text-tinta">
              {formatBRL(item.landedCost)}
            </span>
          </p>
        </div>
      ))}

      {/* ---- Consolidado ---- */}
      {resultado.itens.length > 1 && (
        <div className="painel">
          <div className="painel-titulo">
            <h3 className="font-serifa text-[15px] font-semibold text-tinta">Consolidado</h3>
          </div>
          <dl className="painel-corpo text-[13px]">
            <Linha rotulo="Valor aduaneiro total" valor={resultado.valorAduaneiroTotal} />
            <Linha rotulo="Total de tributos" valor={resultado.totalTributos} />
            <Linha rotulo="Total de custos" valor={resultado.totalCustos} />
            <Linha rotulo="Landed cost" valor={resultado.landedCost} forte />
          </dl>
        </div>
      )}

      {/* ---- Avisos ---- */}
      {resultado.avisos.length > 0 && (
        <div className="aviso-nota">
          <p className="secao mb-1">Avisos</p>
          <ul className="space-y-1">
            {resultado.avisos.map((a, i) => (
              <li key={i}>— {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Premissa do custo efetivo ---- */}
      {temCredito && (
        <div className="aviso-caneta">
          <p className="secao mb-1">Sobre o custo efetivo</p>
          Crédito não é dinheiro de volta: é o direito de abater de um imposto que você vai
          dever na saída. O custo efetivo assume que você aproveita todos os créditos — o que
          vale para quem vende no mercado interno com tributação normal. Se você exporta, vende
          com isenção, ou revende para outro estado (mercadoria importada sai a 4% de ICMS
          interestadual pela Resolução do Senado 13/2012, contra os 17–22% creditados na
          entrada), o crédito se acumula em vez de reduzir custo — e o desembolso real é o
          total de nacionalização.
        </div>
      )}

      {/* ---- Rastreabilidade (RNF-1 / RNF-6) ---- */}
      <div className="rounded border border-fio bg-papel2 px-5 py-4">
        <p className="secao">Rastreabilidade</p>
        <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-[11.5px] sm:grid-cols-2">
          {resultado.baseAto && (
            <Rastro
              rotulo="Base NCM"
              valor={`${resultado.baseAto} (${resultado.baseVigenteEm})`}
            />
          )}
          <Rastro
            rotulo="Regras de cálculo"
            valor={`${resultado.rulesetRotulo} [${resultado.rulesetId}]`}
          />
          {resultado.fx && (
            <Rastro
              rotulo="Câmbio"
              valor={`${resultado.fx.fonte}${resultado.fx.dataRef ? ` · ref. ${resultado.fx.dataRef}` : ""}`}
            />
          )}
          <Rastro rotulo="Calculado em" valor={formatData(resultado.dataReferencia)} />
          {importacaoId && <Rastro rotulo="Identificador" valor={importacaoId} mono />}
        </dl>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 py-0.5 ${
        forte ? "mt-1 border-t border-fio pt-1.5 font-medium text-tinta" : "text-tinta2"
      }`}
    >
      <dt>{rotulo}</dt>
      <dd className="font-mono tabular-nums">{formatBRL(valor)}</dd>
    </div>
  );
}

function Rastro({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-fraco">{rotulo}:</dt>
      <dd className={`min-w-0 break-words text-tinta2 ${mono ? "font-mono" : ""}`}>{valor}</dd>
    </div>
  );
}
