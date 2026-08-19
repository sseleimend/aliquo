"use client";

import { useEffect, useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { useSimulador } from "../SimuladorProvider";
import { numero } from "../rascunho";
import { FxBadge, type CotacaoUi } from "../FxBadge";

/** Sugestão usual de seguro internacional: ~0,3% do valor da carga. */
const PCT_SEGURO_SUGERIDO = 0.003;

/**
 * Passo 4 — frete e seguro (RF-C2), com o câmbio à vista (RF-C1).
 *
 * O seguro é recomendado por padrão e precisa ser DISPENSADO explicitamente.
 * Deixar o campo vazio por esquecimento subestima o custo e, pior, some com
 * a decisão: o importador nunca chega a pensar no risco.
 */
export function Passo4FreteSeguro() {
  const { estado, despachar } = useSimulador();
  const [fx, setFx] = useState<{
    fiscal: CotacaoUi | null;
    mercado: CotacaoUi | null;
    divergenciaPct: number | null;
  }>({ fiscal: null, mercado: null, divergenciaPct: null });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/fx?moeda=${estado.moeda}`);
        const data = await res.json();
        if (!vivo) return;
        if (res.ok) {
          setFx({
            fiscal: data.fiscal,
            mercado: data.mercado,
            divergenciaPct: data.divergenciaPct,
          });
        } else {
          setFx({
            fiscal: null,
            mercado: null,
            divergenciaPct: null,
          });
        }
      } catch {
        /* o badge mostra o estado de carregamento */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [estado.moeda]);

  const fobBrl = estado.itens.reduce(
    (s, i) => s + numero(i.valorUnitarioMoeda) * (numero(i.quantidade) || 1),
    0,
  ) * (fx.fiscal?.rate ?? 0);

  const seguroSugerido = Math.round((fobBrl + numero(estado.freteInternacional)) * PCT_SEGURO_SUGERIDO * 100) / 100;
  const semSeguro = numero(estado.seguroInternacional) <= 0;

  return (
    <div className="space-y-5">
      <FxBadge
        moeda={estado.moeda}
        fiscal={fx.fiscal}
        mercado={fx.mercado}
        divergenciaPct={fx.divergenciaPct}
      />

      <p className="text-xs text-muted">
        A taxa usada no cálculo é a PTAX de venda do dia útil anterior — a base legal para
        valoração aduaneira. A cotação de mercado aparece só como referência.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="frete">
            Frete internacional (R$)
          </label>
          <MoneyInput
            id="frete"
            value={numero(estado.freteInternacional)}
            onValueChange={(n) =>
              despachar({ tipo: "campo", campo: "freteInternacional", valor: String(n) })
            }
          />
          <p className="mt-1 text-xs text-muted">Compõe o valor aduaneiro.</p>
        </div>

        <div>
          <label className="label" htmlFor="seguro">
            Seguro internacional (R$)
          </label>
          <MoneyInput
            id="seguro"
            value={numero(estado.seguroInternacional)}
            onValueChange={(n) => {
              despachar({ tipo: "campo", campo: "seguroInternacional", valor: String(n) });
              if (n > 0) despachar({ tipo: "campo", campo: "seguroDispensado", valor: false });
            }}
          />
          <p className="mt-1 text-xs text-muted">Também compõe o valor aduaneiro.</p>
        </div>
      </div>

      {semSeguro && !estado.seguroDispensado && (
        <div className="rounded-lg border border-warn-border bg-warn-bg p-3 text-sm text-warn-text">
          <p className="font-semibold">Seguro recomendado</p>
          <p className="mt-1 text-xs">
            O seguro internacional costuma custar uma fração do valor da carga e cobre perda
            total no transporte. Para esta importação, algo em torno de{" "}
            <strong>R$ {seguroSugerido.toFixed(2).replace(".", ",")}</strong> (~0,3%).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {seguroSugerido > 0 && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  despachar({
                    tipo: "campo",
                    campo: "seguroInternacional",
                    valor: String(seguroSugerido),
                  })
                }
              >
                Usar sugestão
              </button>
            )}
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => despachar({ tipo: "campo", campo: "seguroDispensado", valor: true })}
            >
              Vou importar sem seguro
            </button>
          </div>
        </div>
      )}

      {semSeguro && estado.seguroDispensado && (
        <p className="text-xs text-muted">
          Importação sem seguro — registrado. O custo de uma perda total ficaria integralmente
          com você.
        </p>
      )}

      <div>
        <label className="label" htmlFor="incoterm">
          Incoterm
        </label>
        <select
          id="incoterm"
          className="input max-w-xs"
          value={estado.incoterm}
          onChange={(e) => despachar({ tipo: "campo", campo: "incoterm", valor: e.target.value })}
        >
          {["FOB", "CIF", "EXW", "FCA", "CFR", "DAP"].map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
