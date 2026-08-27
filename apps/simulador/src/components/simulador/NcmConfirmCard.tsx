"use client";

import { formatarNcm } from "@/lib/ncm/codigo";

/**
 * Cartão de confirmação da NCM (RF-A3, RNF-1).
 *
 * Regra que não se negocia: nunca existe botão de confirmar sem o TEXTO
 * OFICIAL visível. O código vem em monoespaçada e em destaque porque é a
 * chave do documento; a linhagem oficial vem logo abaixo, com a régua
 * separando-a do resto — é o que o usuário está de fato assinando embaixo.
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
      className={`rounded border-l-2 border-y border-r p-3.5 text-left transition-colors ${
        selecionado
          ? "border-l-caneta border-y-caneta-fio border-r-caneta-fio bg-caneta-fraca"
          : "border-l-fio2 border-y-fio border-r-fio bg-folha"
      } ${clicavel ? "cursor-pointer hover:border-l-caneta hover:bg-caneta-fraca/60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[15px] font-semibold tracking-tight text-tinta">
          {formatarNcm(codigo)}
        </span>
        {typeof confianca === "number" && (
          <span className={confianca >= 0.75 ? "selo-visto" : "selo-neutro"}>
            {Math.round(confianca * 100)}% de confiança
          </span>
        )}
        {fonte === "manual" && <span className="selo-neutro">informado por você</span>}
      </div>

      {descricao && <p className="mt-1.5 text-[13.5px] text-tinta">{descricao}</p>}

      {caminho && (
        <p className="mt-2 border-t border-fio pt-2 text-[11.5px] leading-relaxed text-tinta2">
          <span className="secao">Texto oficial</span>
          <br />
          {caminho}
        </p>
      )}

      {porque && <p className="mt-1.5 text-[11.5px] italic text-fraco">{porque}</p>}

      {baseAto && <p className="mt-1.5 text-[11px] text-fraco">Fonte: {baseAto}</p>}
    </div>
  );
}
