"use client";

import { getIcmsUfSync } from "@/lib/tax/rates";
import { erroIcmsDeclarado } from "./rascunho";
import { useSimulador } from "./SimuladorProvider";

/**
 * Declaração de ICMS (RF-B4).
 *
 * Este é o ponto do cálculo com maior margem de erro, e por um motivo que
 * nenhuma tabela resolve: não existe fonte oficial consolidada das alíquotas
 * internas dos 27 estados, e benefício estadual de importação — TTD de Santa
 * Catarina, COMEXPRODUZIR de Goiás, INVEST-ES — depende de habilitação do
 * contribuinte e opera por diferimento e crédito presumido, não por alíquota
 * publicada.
 *
 * A saída honesta é a mesma que o produto usa para o resto: não inventar.
 * A estimativa aparece com o nome de estimativa, a composição fica à vista, e
 * quem tem regime especial informa a carga efetiva — que passa a constar como
 * informação dele, na tela e no PDF.
 */

const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function IcmsDeclaracao() {
  const { estado, despachar } = useSimulador();
  const uf = getIcmsUfSync(estado.uf);

  if (!uf) {
    return (
      <div className="aviso-carimbo">
        Informe a UF de destino no passo “Valores e quantidades” para o ICMS ser calculado.
      </div>
    );
  }

  const especial = estado.icmsRegimeEspecial;
  const fecpAplicado = estado.icmsFecpAplicavel ?? uf.fecpPadrao;
  const total = uf.interna + (fecpAplicado ? uf.fecp : 0);
  const declarada = estado.icmsAliquotaManual ? Number(estado.icmsAliquotaManual) / 100 : null;
  const erro = erroIcmsDeclarado(estado);

  return (
    <section className="painel">
      <div className="painel-titulo">
        <h3 className="font-serifa text-[15px] font-semibold text-tinta">
          ICMS — {estado.uf}
        </h3>
        <span className="font-mono text-[13px] text-tinta">
          {especial ? (erro ? "—" : declarada != null ? pct(declarada) : "—") : pct(total)}
        </span>
      </div>

      <div className="space-y-3 px-5 py-4">
        {/* Composição: 20% + 2% em vez de um 22% opaco. */}
        <dl className="text-[13px]">
          <div className="flex items-baseline justify-between border-b border-fio py-1.5">
            <dt className="text-tinta2">Alíquota interna</dt>
            <dd className="font-mono text-tinta">{pct(uf.interna)}</dd>
          </div>
          {uf.fecp > 0 && (
            <div className="flex items-baseline justify-between border-b border-fio py-1.5">
              <dt className="text-tinta2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fecpAplicado}
                    disabled={especial}
                    onChange={(e) =>
                      despachar({
                        tipo: "campo",
                        campo: "icmsFecpAplicavel",
                        valor: e.target.checked,
                      })
                    }
                  />
                  Adicional de combate à pobreza (FECP)
                </label>
              </dt>
              <dd className="font-mono text-tinta">{fecpAplicado ? pct(uf.fecp) : "—"}</dd>
            </div>
          )}
        </dl>

        {uf.fecp > 0 && !especial && (
          <p className="text-[11.5px] leading-relaxed text-fraco">
            O adicional incide sobre a lista de produtos definida pelo estado, não sobre tudo.
            Desmarque se a sua NCM estiver fora dela.
          </p>
        )}

        {uf.estimativa && !especial && (
          <p className="aviso-nota">
            <strong>Esta alíquota é estimativa.</strong> Não existe tabela oficial consolidada das
            alíquotas internas dos 27 estados — cada um fixa a sua no próprio RICMS. Confirme na
            SEFAZ de {estado.uf} antes de usar o número para decidir.
          </p>
        )}

        {/* Regime especial */}
        <label className="flex cursor-pointer items-start gap-2 border-t border-fio pt-3 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={especial}
            onChange={(e) =>
              despachar({ tipo: "campo", campo: "icmsRegimeEspecial", valor: e.target.checked })
            }
          />
          <span>
            <span className="text-tinta">Tenho regime especial de importação neste estado</span>
            <span className="mt-0.5 block text-[11.5px] text-fraco">
              TTD, COMEXPRODUZIR, INVEST-ES e semelhantes. Dependem de habilitação e funcionam por
              diferimento e crédito presumido — nenhuma tabela acerta a carga efetiva.
            </span>
          </span>
        </label>

        {especial && (
          <div className="grid gap-3 border-l-2 border-l-caneta bg-caneta-fraca px-3.5 py-3 sm:grid-cols-[140px_1fr]">
            <div>
              <label className="label" htmlFor="icms-aliq">
                Alíquota efetiva
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="icms-aliq"
                  aria-invalid={erro != null}
                  className={`input ${erro ? "border-carimbo focus:border-carimbo focus:ring-carimbo-fraca" : ""}`}
                  inputMode="decimal"
                  placeholder="4"
                  value={estado.icmsAliquotaManual}
                  onChange={(e) =>
                    despachar({
                      tipo: "campo",
                      campo: "icmsAliquotaManual",
                      valor: e.target.value.replace(",", "."),
                    })
                  }
                />
                <span className="text-[13px] text-tinta2">%</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="icms-obs">
                Qual regime
              </label>
              <input
                id="icms-obs"
                className="input"
                placeholder="Ex.: TTD 409 — SC"
                value={estado.icmsObservacao}
                onChange={(e) =>
                  despachar({ tipo: "campo", campo: "icmsObservacao", valor: e.target.value })
                }
              />
            </div>
            {erro ? (
              <p className="text-[11.5px] font-medium leading-relaxed text-carimbo sm:col-span-2">
                {erro}
              </p>
            ) : (
              <p className="text-[11.5px] leading-relaxed text-caneta-forte sm:col-span-2">
                O resultado vai registrar esta alíquota como informada por você, com o regime
                identificado — na tela e no PDF.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
