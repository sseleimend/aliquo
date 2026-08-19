"use client";

import { MoneyInput } from "@/components/MoneyInput";
import { formatarNcm } from "@/lib/ncm/codigo";
import { UF_LIST } from "@/lib/tax/uf";
import { useSimulador } from "../SimuladorProvider";
import { fobTotalMoeda, numero } from "../rascunho";
import { formatMoeda } from "@/lib/format";

const MOEDAS = ["USD", "EUR", "CNY", "GBP", "JPY", "CHF", "CAD", "AUD", "MXN"];

/** Passo 3 — valores e quantidades por item (RF-D1). */
export function Passo3Itens() {
  const { estado, despachar } = useSimulador();
  const total = fobTotalMoeda(estado);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="moeda">
            Moeda da fatura
          </label>
          <select
            id="moeda"
            className="input"
            value={estado.moeda}
            onChange={(e) => despachar({ tipo: "campo", campo: "moeda", valor: e.target.value })}
          >
            {MOEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="uf">
            UF de destino
          </label>
          <select
            id="uf"
            className="input"
            value={estado.uf}
            onChange={(e) => despachar({ tipo: "campo", campo: "uf", valor: e.target.value })}
          >
            {UF_LIST.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="regime">
            Regime tributário
          </label>
          <select
            id="regime"
            className="input"
            value={estado.regimeTributario}
            onChange={(e) =>
              despachar({ tipo: "campo", campo: "regimeTributario", valor: e.target.value })
            }
          >
            <option value="lucro_real">Lucro Real</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="simples_nacional">Simples Nacional</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted">
        O regime muda o quanto dos tributos volta como crédito — e portanto o custo efetivo,
        não o desembolso.
      </p>

      <div className="space-y-4">
        {estado.itens.map((item, i) => (
          <div key={item.id} className="card p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-ink">
                {formatarNcm(item.ncm)}
              </span>
              <span className="text-xs text-muted">
                {item.descricaoProduto || item.ncmDescricaoOficial}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor={`vu-${item.id}`}>
                  Valor unitário ({estado.moeda})
                </label>
                <MoneyInput
                  id={`vu-${item.id}`}
                  prefix={estado.moeda}
                  value={numero(item.valorUnitarioMoeda)}
                  onValueChange={(n) =>
                    despachar({
                      tipo: "item.campo",
                      indice: i,
                      campo: "valorUnitarioMoeda",
                      valor: String(n),
                    })
                  }
                />
              </div>

              <div>
                <label className="label" htmlFor={`qt-${item.id}`}>
                  Quantidade
                </label>
                <input
                  id={`qt-${item.id}`}
                  type="number"
                  min={1}
                  step="1"
                  className="input"
                  value={item.quantidade}
                  onChange={(e) =>
                    despachar({
                      tipo: "item.campo",
                      indice: i,
                      campo: "quantidade",
                      valor: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="label" htmlFor={`pe-${item.id}`}>
                  Peso líquido (kg) — opcional
                </label>
                <input
                  id={`pe-${item.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={item.pesoLiquidoKg}
                  onChange={(e) =>
                    despachar({
                      tipo: "item.campo",
                      indice: i,
                      campo: "pesoLiquidoKg",
                      valor: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <p className="mt-2 text-right text-xs text-muted">
              Subtotal:{" "}
              {formatMoeda(
                numero(item.valorUnitarioMoeda) * (numero(item.quantidade) || 1),
                estado.moeda,
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => despachar({ tipo: "item.add" })}>
          + Adicionar item
        </button>
        <p className="text-sm font-semibold text-ink">
          Total da fatura: {formatMoeda(total, estado.moeda)}
        </p>
      </div>

      {estado.itens.length > 1 && (
        <div>
          <label className="label" htmlFor="rateio">
            Critério de rateio de frete e seguro
          </label>
          <select
            id="rateio"
            className="input max-w-xs"
            value={estado.criterioRateio}
            onChange={(e) =>
              despachar({ tipo: "campo", campo: "criterioRateio", valor: e.target.value })
            }
          >
            <option value="valor">Por valor (padrão)</option>
            <option value="peso">Por peso líquido</option>
            <option value="quantidade">Por quantidade</option>
          </select>
          <p className="mt-1 text-xs text-muted">
            Frete e seguro chegam no nível do embarque e precisam ser distribuídos entre os itens
            antes de calcular os tributos de cada NCM.
          </p>
        </div>
      )}
    </div>
  );
}
