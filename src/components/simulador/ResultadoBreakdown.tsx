"use client";

import { formatBRL, formatData, formatMoeda, formatPct } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import type { ResultadoCalculo } from "@/lib/tax/types";

/**
 * Breakdown transparente (RF-C3) com rastreabilidade visível (RNF-1).
 *
 * Cada linha de tributo mostra alíquota, base, valor, a FONTE da alíquota e o
 * fundamento legal. Quando algo está bloqueado, o número grande aparece
 * marcado como provisório em vez de fingir precisão.
 */
export function ResultadoBreakdown({
  resultado,
  importacaoId,
}: {
  resultado: ResultadoCalculo;
  importacaoId?: string | null;
}) {
  const prov = resultado.provisorio;

  return (
    <div className="space-y-5">
      {/* ---- Hero ---- */}
      <div
        className={`rounded-xl border p-5 ${
          prov ? "border-danger-border bg-danger-bg" : "border-accent-border bg-accent-bg"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Custo total de nacionalização
        </p>
        <p className={`mt-1 text-3xl font-bold ${prov ? "text-danger-text" : "text-accent-text"}`}>
          {formatBRL(resultado.landedCost)}
        </p>
        {prov && (
          <p className="mt-1 text-sm font-semibold text-danger-text">
            SIMULAÇÃO PROVISÓRIA — falta alíquota oficial. Este valor ainda não é confiável.
          </p>
        )}
        {!prov && resultado.creditosRecuperaveis.length > 0 && (
          <p className="mt-1 text-sm text-ink">
            Custo efetivo após créditos ({resultado.regime.replace(/_/g, " ")}):{" "}
            <strong>{formatBRL(resultado.landedCostEfetivo)}</strong>
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          {resultado.itens.length} item(ns) · UF {resultado.uf || "?"} · 1 {resultado.moeda} ={" "}
          {formatBRL(resultado.taxaCambio)}
        </p>
      </div>

      {/* ---- Bloqueios ---- */}
      {resultado.bloqueios.length > 0 && (
        <div className="rounded-xl border border-danger-border bg-white p-4">
          <p className="text-sm font-semibold text-danger-text">Pendências que travam o cálculo</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {resultado.bloqueios.map((b, i) => (
              <li key={`${b.campo}-${i}`}>
                • {b.item != null ? `Item ${b.item + 1}: ` : ""}
                {b.mensagem}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Itens ---- */}
      {resultado.itens.map((item) => (
        <div key={`${item.ordem}-${item.ncm}`} className="card p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-ink">
              {formatarNcm(item.ncm)}
            </span>
            {resultado.itens.length > 1 && (
              <span className="text-xs text-muted">Item {item.ordem + 1}</span>
            )}
          </div>

          {item.caminhoOficial && (
            <p className="mb-3 text-xs leading-relaxed text-muted">
              <span className="font-semibold uppercase tracking-wide">Texto oficial:</span>{" "}
              {item.caminhoOficial}
            </p>
          )}

          {/* Composição do valor aduaneiro */}
          <dl className="mb-3 space-y-1 text-sm">
            <Linha
              rotulo={`FOB (${formatMoeda(item.fobMoeda, resultado.moeda)} × ${formatBRL(resultado.taxaCambio)})`}
              valor={item.fobBrl}
            />
            {item.freteRateado > 0 && <Linha rotulo="Frete internacional" valor={item.freteRateado} />}
            {item.seguroRateado > 0 && <Linha rotulo="Seguro internacional" valor={item.seguroRateado} />}
            <Linha rotulo="Valor aduaneiro" valor={item.valorAduaneiro} forte />
          </dl>

          {/* Tributos */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2 font-semibold">Tributo</th>
                  <th className="py-2 pr-2 font-semibold">Alíquota</th>
                  <th className="py-2 pr-2 font-semibold">Base</th>
                  <th className="py-2 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {item.tributos.map((t) => (
                  <tr key={t.chave} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-2">
                      <div className="text-ink">{t.rotulo}</div>
                      {t.observacao && <div className="text-xs text-muted">{t.observacao}</div>}
                      <div className="text-[11px] text-muted">
                        {t.fonteAliquota} · {t.fonteLegal}
                      </div>
                      {t.creditavel && (
                        <span className="badge mt-1 bg-teal-bg text-teal-text">recuperável</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-ink">{formatPct(t.aliquota)}</td>
                    <td className="py-2 pr-2 tabular-nums text-muted">{formatBRL(t.base)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-ink">
                      {formatBRL(t.valor)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold text-ink" colSpan={3}>
                    Total de tributos
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-ink">
                    {formatBRL(item.totalTributos)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {item.custosRateados.length > 0 && (
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {item.custosRateados.map((c) => (
                <Linha
                  key={c.chave}
                  rotulo={c.rotulo + (c.criterioRateio ? ` (rateio por ${c.criterioRateio})` : "")}
                  valor={c.valor}
                />
              ))}
              <Linha rotulo="Total de custos" valor={item.totalCustos} forte />
            </dl>
          )}

          <p className="mt-3 border-t border-line pt-3 text-right text-sm font-semibold text-ink">
            Landed cost do item: {formatBRL(item.landedCost)}
          </p>
        </div>
      ))}

      {/* ---- Consolidado ---- */}
      {resultado.itens.length > 1 && (
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Consolidado</p>
          <dl className="space-y-1 text-sm">
            <Linha rotulo="Valor aduaneiro total" valor={resultado.valorAduaneiroTotal} />
            <Linha rotulo="Total de tributos" valor={resultado.totalTributos} />
            <Linha rotulo="Total de custos" valor={resultado.totalCustos} />
            <Linha rotulo="Landed cost" valor={resultado.landedCost} forte />
          </dl>
        </div>
      )}

      {/* ---- Avisos ---- */}
      {resultado.avisos.length > 0 && (
        <div className="rounded-xl border border-warn-border bg-warn-bg p-4 text-sm text-warn-text">
          <p className="font-semibold">Avisos</p>
          <ul className="mt-1 space-y-1">
            {resultado.avisos.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Rastreabilidade (RNF-1 / RNF-6) ---- */}
      <div className="rounded-xl border border-line bg-page p-4 text-xs text-muted">
        <p className="font-semibold uppercase tracking-wide">Rastreabilidade</p>
        <ul className="mt-1 space-y-0.5">
          {resultado.baseAto && (
            <li>
              Base NCM: {resultado.baseAto} ({resultado.baseVigenteEm})
            </li>
          )}
          <li>
            Regras de cálculo: {resultado.rulesetRotulo} [{resultado.rulesetId}]
          </li>
          {resultado.fx && (
            <li>
              Câmbio: {resultado.fx.fonte}
              {resultado.fx.dataRef ? ` · referência ${resultado.fx.dataRef}` : ""}
            </li>
          )}
          <li>Cálculo em {formatData(resultado.dataReferencia)}</li>
          {importacaoId && <li>Identificador: {importacaoId}</li>}
        </ul>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${forte ? "font-semibold text-ink" : "text-ink2"}`}>
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{formatBRL(valor)}</dd>
    </div>
  );
}
