"use client";

import { useSimulador } from "../SimuladorProvider";
import { NcmConfirmCard } from "../NcmConfirmCard";

/**
 * Passo 2 — revisão das NCMs confirmadas.
 *
 * Existe como passo próprio porque a confirmação é a fronteira do produto: é
 * onde a sugestão da IA vira uma decisão do usuário. Com múltiplos itens, é
 * aqui que se vê tudo junto antes de qualquer número ser calculado.
 */
export function Passo2Ncm({ baseAto }: { baseAto?: string }) {
  const { estado, despachar } = useSimulador();

  return (
    <div className="space-y-4">
      <p className="text-sm text-fraco">
        Confira as classificações antes de calcular. Cada uma mostra o texto oficial que a
        sustenta — a decisão final é sua.
      </p>

      <div className="space-y-3">
        {estado.itens.map((item, i) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fraco">
                Item {i + 1}
                {item.descricaoProduto ? ` · ${item.descricaoProduto}` : ""}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => {
                    despachar({ tipo: "item.ativo", indice: i });
                    despachar({ tipo: "passo", passo: 0 });
                  }}
                >
                  {item.confirmado ? "Reclassificar" : "Classificar"}
                </button>
                {estado.itens.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost text-xs text-carimbo"
                    onClick={() => despachar({ tipo: "item.remove", indice: i })}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            {item.confirmado ? (
              <NcmConfirmCard
                codigo={item.ncm}
                descricao={item.ncmDescricaoOficial}
                caminho={item.ncmCaminhoOficial}
                confianca={item.ncmConfianca}
                fonte={item.ncmFonte === "manual" ? "manual" : undefined}
                baseAto={baseAto}
                selecionado
              />
            ) : (
              <div className="aviso-nota">
                Este item ainda não tem NCM confirmada — o cálculo não prossegue sem ela.
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" onClick={() => despachar({ tipo: "item.add" })}>
        + Adicionar outro item
      </button>
    </div>
  );
}
