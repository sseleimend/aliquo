"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Ações por linha do histórico (RF-D4).
 *
 * Duplicar não copia o resultado antigo — leva o usuário ao simulador com os
 * dados de entrada e força um novo cálculo com câmbio e alíquotas atuais.
 * Reapresentar um número velho como atual seria o oposto do que a Fase 2 faz.
 */
export function AcoesImportacao({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"duplicar" | "remover" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function remover() {
    if (!confirm("Remover esta importação do histórico?")) return;
    setOcupado("remover");
    setErro(null);
    try {
      const res = await fetch(`/api/importacoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? "Falha ao remover.");
        return;
      }
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <a className="text-accent-text hover:underline" href={`/api/export/pdf?id=${id}`}>
        PDF
      </a>
      <span className="text-line">·</span>
      <a className="text-accent-text hover:underline" href={`/api/export/excel?id=${id}`}>
        Excel
      </a>
      <span className="text-line">·</span>
      <button
        type="button"
        className="text-accent-text hover:underline disabled:opacity-50"
        disabled={ocupado !== null}
        onClick={() => {
          setOcupado("duplicar");
          router.push(`/simulador?duplicar=${id}`);
        }}
      >
        {ocupado === "duplicar" ? "Abrindo…" : "Usar como base"}
      </button>
      <span className="text-line">·</span>
      <button
        type="button"
        className="text-danger-text hover:underline disabled:opacity-50"
        disabled={ocupado !== null}
        onClick={remover}
      >
        {ocupado === "remover" ? "…" : "Remover"}
      </button>
      {erro && <span className="ml-2 text-xs text-danger-text">{erro}</span>}
    </div>
  );
}
