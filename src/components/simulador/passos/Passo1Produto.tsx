"use client";

import { useState } from "react";
import { apenasDigitos, formatarNcm } from "@/lib/ncm/codigo";
import { useSimulador } from "../SimuladorProvider";
import { itemAtivo } from "../rascunho";
import { ChatNcm, type CandidatoUi } from "../ChatNcm";
import { HistoricoPicker } from "../HistoricoPicker";
import { NcmConfirmCard } from "../NcmConfirmCard";

/**
 * Passo 1 — três portas de entrada para a classificação:
 *
 *   descrever o produto (guiado)  ·  digitar a NCM (RF-A3)  ·  reusar do histórico (RF-D2/D4)
 *
 * O reuso precisa estar AQUI, e não só no passo de valores: uma importação
 * anterior já traz as NCMs confirmadas, então exigir uma classificação manual
 * antes de poder carregá-la seria pedir o trabalho que o reuso elimina.
 */
export function Passo1Produto({ baseAto }: { baseAto?: string }) {
  const { estado, despachar } = useSimulador();
  const item = itemAtivo(estado);
  const [aba, setAba] = useState<"descrever" | "codigo" | "historico">(
    estado.modo === "rapido" ? "codigo" : "descrever",
  );
  const [codigo, setCodigo] = useState(item.ncmFmt);
  const [verificado, setVerificado] = useState<{
    encontrado: boolean;
    descricao?: string | null;
    caminho?: string | null;
    aviso?: string | null;
  } | null>(null);
  const [verificando, setVerificando] = useState(false);

  function confirmar(c: CandidatoUi) {
    despachar({
      tipo: "item.confirmarNcm",
      indice: estado.itemAtivo,
      ncm: c.codigo,
      ncmFmt: c.ncm,
      descricaoOficial: c.descricao,
      caminhoOficial: c.caminho,
      fonte: "ia_confirmada",
      confianca: c.confianca,
    });
    despachar({ tipo: "passo", passo: 1 });
  }

  async function verificar() {
    const d = apenasDigitos(codigo);
    if (d.length !== 8) {
      setVerificado({ encontrado: false, aviso: "Informe um NCM com 8 dígitos." });
      return;
    }
    setVerificando(true);
    try {
      const res = await fetch(`/api/ncm/search?ncm=${d}`);
      const data = await res.json();
      setVerificado(data);
    } catch {
      setVerificado({ encontrado: false, aviso: "Falha ao consultar a base." });
    } finally {
      setVerificando(false);
    }
  }

  function confirmarManual() {
    const d = apenasDigitos(codigo);
    if (d.length !== 8 || !verificado?.encontrado) return;
    despachar({
      tipo: "item.confirmarNcm",
      indice: estado.itemAtivo,
      ncm: d,
      ncmFmt: formatarNcm(d),
      descricaoOficial: verificado.descricao ?? undefined,
      caminhoOficial: verificado.caminho ?? undefined,
      fonte: "manual",
    });
    despachar({ tipo: "passo", passo: 1 });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba("descrever")}
          className={aba === "descrever" ? "btn-primary" : "btn-secondary"}
        >
          Descrever o produto
        </button>
        <button
          type="button"
          onClick={() => setAba("codigo")}
          className={aba === "codigo" ? "btn-primary" : "btn-secondary"}
        >
          Já sei o NCM
        </button>
        <button
          type="button"
          onClick={() => setAba("historico")}
          className={aba === "historico" ? "btn-primary" : "btn-secondary"}
        >
          Reusar do histórico
        </button>
      </div>

      {aba === "historico" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Comece a partir de uma importação que você já fez — produtos, NCMs confirmadas,
            quantidades, custos e a fatura anexada vêm junto.
          </p>
          <HistoricoPicker />
        </div>
      )}

      {aba === "descrever" && (
        <ChatNcm
          descricao={item.descricaoProduto}
          onDescricaoChange={(v) =>
            despachar({
              tipo: "item.campo",
              indice: estado.itemAtivo,
              campo: "descricaoProduto",
              valor: v,
            })
          }
          onConfirmar={confirmar}
          baseAto={baseAto}
        />
      )}

      {aba === "codigo" && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="ncm-direto">
              Código NCM
            </label>
            <div className="flex gap-2">
              <input
                id="ncm-direto"
                className="input font-mono"
                placeholder="0000.00.00"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setVerificado(null);
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={verificar}
                disabled={verificando}
              >
                {verificando ? "..." : "Verificar"}
              </button>
            </div>
          </div>

          {verificado?.encontrado && (
            <>
              <NcmConfirmCard
                codigo={apenasDigitos(codigo)}
                descricao={verificado.descricao ?? undefined}
                caminho={verificado.caminho ?? undefined}
                fonte="manual"
                baseAto={baseAto}
                selecionado
              />
              <button type="button" className="btn-primary w-full" onClick={confirmarManual}>
                Confirmar esta NCM e continuar
              </button>
            </>
          )}

          {verificado && !verificado.encontrado && (
            <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
              {verificado.aviso ?? "NCM não encontrada na base oficial."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
