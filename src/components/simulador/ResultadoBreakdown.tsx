"use client";

import { formatBRL, formatMoeda, formatPct } from "@/lib/format";
import type { TaxResult } from "@/lib/tax/types";

export function ResultadoBreakdown({
  resultado,
  simId,
}: {
  resultado: TaxResult;
  simId?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent-border bg-accent-bg p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
              Landed cost — custo total de nacionalização
            </p>
            <p className="mt-1 text-3xl font-semibold text-accent-text">
              {formatBRL(resultado.landedCost)}
            </p>
          </div>
          <div className="text-right text-sm text-accent-text">
            <div>NCM {resultado.ncm}</div>
            <div>UF {resultado.uf}</div>
          </div>
        </div>
      </div>

      {/* Valor aduaneiro */}
      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-ink">Valor aduaneiro (base CIF)</h3>
        <Linha
          rot={
            (resultado.quantidade ?? 1) > 1
              ? `FOB (${formatMoeda(
                  resultado.valorUnitarioMoeda ?? resultado.fobMoeda,
                  resultado.moeda,
                )} × ${resultado.quantidade} un × ${formatBRL(resultado.taxaCambio)})`
              : `FOB (${formatMoeda(resultado.fobMoeda, resultado.moeda)} × ${formatBRL(
                  resultado.taxaCambio,
                )})`
          }
          val={resultado.fobBrl}
        />
        <Linha rot="Frete internacional" val={resultado.freteInternacional} />
        <Linha rot="Seguro internacional" val={resultado.seguroInternacional} />
        <Linha rot="Valor aduaneiro" val={resultado.valorAduaneiro} destaque />
      </section>

      {/* Tributos */}
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-accent-bg px-4 py-2 text-sm font-semibold text-accent-text">
          Tributos
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted">
              <th className="px-4 py-2 font-semibold">Tributo</th>
              <th className="px-4 py-2 text-right font-semibold">Alíquota</th>
              <th className="px-4 py-2 text-right font-semibold">Base</th>
              <th className="px-4 py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {resultado.tributos.map((t) => (
              <tr key={t.chave} className="border-t border-line">
                <td className="px-4 py-2">
                  {t.rotulo}
                  {t.observacao ? (
                    <span className="block text-xs text-muted">{t.observacao}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPct(t.aliquota)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink2">{formatBRL(t.base)}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatBRL(t.valor)}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-page font-semibold">
              <td className="px-4 py-2" colSpan={3}>
                Total de tributos
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{formatBRL(resultado.totalTributos)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Custos */}
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-teal-bg px-4 py-2 text-sm font-semibold text-teal-text">
          Custos variáveis
        </div>
        <table className="w-full text-sm">
          <tbody>
            {resultado.custos.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted">Nenhum custo variável informado.</td>
              </tr>
            ) : (
              resultado.custos.map((c) => (
                <tr key={c.chave} className="border-t border-line first:border-t-0">
                  <td className="px-4 py-2">{c.rotulo}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatBRL(c.valor)}</td>
                </tr>
              ))
            )}
            <tr className="border-t border-line bg-page font-semibold">
              <td className="px-4 py-2">Total de custos</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatBRL(resultado.totalCustos)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {resultado.avisos.length > 0 ? (
        <div className="rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-[13px] text-warn-text">
          <strong>Avisos:</strong>
          <ul className="mt-1 list-disc pl-5">
            {resultado.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Exportação (RF15) */}
      {simId ? (
        <div className="flex flex-wrap gap-3">
          <a className="btn-secondary" href={`/api/export/pdf?id=${simId}`}>
            ⬇ Exportar PDF
          </a>
          <a className="btn-secondary" href={`/api/export/excel?id=${simId}`}>
            ⬇ Exportar Excel
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Linha({ rot, val, destaque }: { rot: string; val: number; destaque?: boolean }) {
  return (
    <div
      className={`flex justify-between border-t border-line py-1.5 text-sm first:border-t-0 ${
        destaque ? "mt-1 border-t-2 font-semibold text-ink" : "text-ink2"
      }`}
    >
      <span>{rot}</span>
      <span className="tabular-nums">{formatBRL(val)}</span>
    </div>
  );
}
