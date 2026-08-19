"use client";

import { formatarNcm } from "@/lib/ncm/codigo";

/**
 * Cartão de confirmação da NCM (RF-A3, RNF-1).
 *
 * Regra que não se negocia: nunca existe botão de confirmar sem o TEXTO
 * OFICIAL visível. Na Fase 1 o usuário confirmava um código acompanhado de
 * uma descrição inventada pela IA; aqui o que ele lê é a linhagem publicada
 * pela Receita, e é sobre isso que ele decide.
 */
export function NcmConfirmCard({
  codigo,
  caminho,
  descricao,
  confianca,
  fonte,
  baseAto,
  selecionado,
  onSelecionar,
  porque,
}: {
  codigo: string;
  caminho?: string;
  descricao?: string;
  confianca?: number;
  fonte?: string;
  baseAto?: string;
  selecionado?: boolean;
  onSelecionar?: () => void;
  porque?: string;
}) {
  const clicavel = Boolean(onSelecionar);
  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onSelecionar}
      onKeyDown={(e) => {
        if (clicavel && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelecionar?.();
        }
      }}
      className={`rounded-xl border p-3 text-left transition ${
        selecionado ? "border-accent-border bg-accent-bg" : "border-line bg-white"
      } ${clicavel ? "cursor-pointer hover:border-accent-border" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{formatarNcm(codigo)}</span>
        {typeof confianca === "number" && (
          <span className="badge bg-accent-bg text-accent-text">
            {Math.round(confianca * 100)}% de confiança
          </span>
        )}
        {fonte === "manual" && <span className="badge bg-page text-muted">informado por você</span>}
      </div>

      {descricao && <p className="mt-1 text-sm text-ink">{descricao}</p>}

      {caminho && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          <span className="font-semibold uppercase tracking-wide">Texto oficial:</span> {caminho}
        </p>
      )}

      {porque && <p className="mt-1 text-xs italic text-muted">{porque}</p>}

      {baseAto && <p className="mt-1 text-[11px] text-muted">Fonte: {baseAto}</p>}
    </div>
  );
}
