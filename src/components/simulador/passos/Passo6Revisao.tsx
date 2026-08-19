"use client";

import Link from "next/link";
import { ResultadoBreakdown } from "../ResultadoBreakdown";
import { useSimulador } from "../SimuladorProvider";
import { limparRascunhoSalvo } from "../SimuladorProvider";

/** Passo 6 — revisar, salvar e exportar (RF-C3, RF-D3). */
export function Passo6Revisao() {
  const { estado, despachar } = useSimulador();

  if (!estado.resultado) {
    return (
      <div className="rounded-lg border border-line bg-page px-4 py-6 text-center text-sm text-muted">
        Nada calculado ainda. Volte e clique em “Calcular custo total”.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ResultadoBreakdown resultado={estado.resultado} importacaoId={estado.importacaoId} />

      <div className="flex flex-wrap gap-2">
        {estado.importacaoId && (
          <>
            <a className="btn-secondary" href={`/api/export/pdf?id=${estado.importacaoId}`}>
              Exportar PDF
            </a>
            <a className="btn-secondary" href={`/api/export/excel?id=${estado.importacaoId}`}>
              Exportar Excel
            </a>
          </>
        )}
        <Link className="btn-ghost" href="/historico">
          Ver histórico
        </Link>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            limparRascunhoSalvo();
            despachar({ tipo: "reset" });
          }}
        >
          Nova simulação
        </button>
      </div>

      <p className="text-xs text-muted">
        Esta simulação foi salva no seu histórico com as alíquotas, o câmbio e a versão das regras
        usadas — você pode reabri-la e duplicá-la depois.
      </p>
    </div>
  );
}
