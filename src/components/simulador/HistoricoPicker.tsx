"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL, formatData } from "@/lib/format";
import { useSimulador } from "./SimuladorProvider";
import { carregarDeDuplicata } from "./duplicar";

/**
 * Reuso a partir do histórico (RF-D2 / RF-D4).
 *
 * A fonte de itens reaproveitáveis é o que o usuário JÁ importou — não um
 * cadastro paralelo digitado à mão. Escolher uma importação anterior traz
 * produtos, NCMs confirmadas, quantidades, valores, custos e a fatura anexada.
 *
 * O que NÃO vem junto é o resultado: câmbio e alíquotas são buscados de novo
 * no cálculo, porque um número de semanas atrás não descreve o custo de hoje.
 */

interface ImportacaoUi {
  id: string;
  apelido: string | null;
  uf: string;
  moeda: string;
  landedCost: number;
  provisorio: boolean;
  createdAt: string;
  ncmPrincipal: string | null;
  qtdItens: number;
  itens: Array<{ ncm: string; descricaoProduto: string | null }>;
}

export function HistoricoPicker() {
  const { despachar } = useSimulador();
  const [importacoes, setImportacoes] = useState<ImportacaoUi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usando, setUsando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/importacoes");
      if (res.ok) setImportacoes((await res.json()).importacoes ?? []);
      else setErro("Não foi possível carregar o histórico.");
    } catch {
      setErro("Não foi possível carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function usar(id: string) {
    setUsando(id);
    setErro(null);
    const r = await carregarDeDuplicata(id, despachar);
    if (!r.ok) setErro(r.erro);
    setUsando(null);
  }

  if (carregando) {
    return <p className="text-sm text-muted">Carregando seu histórico…</p>;
  }

  if (erro) {
    return (
      <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
        {erro}
      </div>
    );
  }

  if (importacoes.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-page px-4 py-6 text-center text-sm text-muted">
        Você ainda não salvou nenhuma importação. Depois da primeira, ela aparece aqui para
        ser reaproveitada — com produtos, NCMs e fatura.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {importacoes.map((imp) => (
        <div
          key={imp.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {imp.apelido ?? imp.itens[0]?.descricaoProduto ?? "Importação sem apelido"}
            </p>
            <p className="text-xs text-muted">
              {imp.ncmPrincipal ?? "—"}
              {imp.qtdItens > 1 && ` +${imp.qtdItens - 1} item(ns)`}
              {` · ${imp.uf} · ${formatData(imp.createdAt)}`}
            </p>
            <p className="text-xs text-muted">
              {formatBRL(imp.landedCost)}
              {imp.provisorio && (
                <span className="badge ml-2 bg-danger-bg text-danger-text">provisório</span>
              )}
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary shrink-0 text-xs"
            disabled={usando !== null}
            onClick={() => usar(imp.id)}
          >
            {usando === imp.id ? "Carregando…" : "Usar como base"}
          </button>
        </div>
      ))}

      <p className="pt-1 text-xs text-muted">
        Os valores são copiados, mas câmbio e alíquotas serão buscados de novo no cálculo —
        podem ter mudado desde a importação original.
      </p>
    </div>
  );
}
