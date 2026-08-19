"use client";

import { useCallback, useState } from "react";
import { NcmConfirmCard } from "./NcmConfirmCard";

/**
 * Descoberta de NCM (RF-A1, RF-A2, RF-A3).
 *
 * Diferença estrutural em relação à Fase 1: as perguntas de refino não são
 * texto livre. Cada opção é um FRAGMENTO DO TEXTO OFICIAL e carrega o índice
 * do candidato, então a resposta volta mecanicamente para um código — sem
 * reinterpretar o que o usuário escreveu.
 */

export interface CandidatoUi {
  ncm: string;
  codigo: string;
  descricao: string;
  caminho: string;
  confianca: number;
  porque?: string;
}

interface OpcaoPergunta {
  i: number;
  rotulo: string;
  textoOficial: string;
}

interface PerguntaUi {
  texto: string;
  atributo: string;
  opcoes: OpcaoPergunta[];
  numerica: boolean;
}

interface RespostaApi {
  reformulacao: string | null;
  proximaPergunta: PerguntaUi | null;
  candidatos: CandidatoUi[] | null;
  disclaimer: string;
  avisos: string[];
  meta: { usouIA: boolean; indiceDegradado: boolean; recuperados: number };
  error?: string;
  upgrade?: boolean;
}

export function ChatNcm({
  descricao,
  onDescricaoChange,
  onConfirmar,
  baseAto,
}: {
  descricao: string;
  onDescricaoChange: (s: string) => void;
  onConfirmar: (c: CandidatoUi) => void;
  baseAto?: string;
}) {
  const [respostas, setRespostas] = useState<Array<{ atributo: string; valor: string }>>([]);
  const [resposta, setResposta] = useState<RespostaApi | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const consultar = useCallback(
    async (novasRespostas: Array<{ atributo: string; valor: string }>) => {
      if (descricao.trim().length < 2) return;
      setCarregando(true);
      setErro(null);
      try {
        const res = await fetch("/api/ncm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descricao, respostas: novasRespostas }),
        });
        const data = (await res.json()) as RespostaApi;
        if (!res.ok) {
          setErro(data.error ?? "Falha ao consultar a base de NCM.");
          return;
        }
        setResposta(data);
        setRespostas(novasRespostas);
        setSelecionado(data.candidatos?.[0]?.codigo ?? null);
      } catch {
        setErro("Não foi possível consultar a base de NCM. Verifique a conexão.");
      } finally {
        setCarregando(false);
      }
    },
    [descricao],
  );

  function responder(opcao: OpcaoPergunta, atributo: string) {
    consultar([...respostas, { atributo, valor: opcao.rotulo }]);
  }

  const candidatos = resposta?.candidatos ?? [];
  const escolhido = candidatos.find((c) => c.codigo === selecionado);

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="descricao-produto">
          Descreva o produto
        </label>
        <textarea
          id="descricao-produto"
          className="input min-h-[84px] resize-y"
          placeholder="Ex.: robô aspirador de pó, motor de 60 W, reservatório de 0,6 litro"
          value={descricao}
          onChange={(e) => onDescricaoChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">
          Inclua material, função e características técnicas (potência, capacidade, dimensões) —
          é o que separa uma NCM da outra.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={carregando || descricao.trim().length < 2}
        onClick={() => consultar([])}
      >
        {carregando ? "Buscando na base oficial…" : "Buscar classificação"}
      </button>

      {erro && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {erro}
        </div>
      )}

      {resposta?.reformulacao && (
        <p className="text-sm text-muted">
          <span aria-hidden>🔎</span> {resposta.reformulacao}
        </p>
      )}

      {resposta?.avisos.map((a) => (
        <div
          key={a}
          className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn-text"
        >
          {a}
        </div>
      ))}

      {/* RF-A2 — desambiguação por atributo, com o texto oficial como opção */}
      {resposta?.proximaPergunta && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink">{resposta.proximaPergunta.texto}</p>
          <p className="mt-1 text-xs text-muted">
            As opções abaixo são o texto oficial que diferencia as classificações.
          </p>
          <div className="mt-3 space-y-2">
            {resposta.proximaPergunta.opcoes.map((o) => (
              <button
                key={`${o.i}-${o.rotulo}`}
                type="button"
                disabled={carregando}
                onClick={() => responder(o, resposta.proximaPergunta!.atributo)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink transition hover:border-accent-border hover:bg-accent-bg"
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {candidatos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            {candidatos.length} classificação(ões) da base oficial
          </p>
          {candidatos.map((c) => (
            <NcmConfirmCard
              key={c.codigo}
              codigo={c.codigo}
              descricao={c.descricao}
              caminho={c.caminho}
              confianca={c.confianca}
              porque={c.porque}
              baseAto={baseAto}
              selecionado={selecionado === c.codigo}
              onSelecionar={() => setSelecionado(c.codigo)}
            />
          ))}

          <p className="pt-1 text-xs text-muted">{resposta?.disclaimer}</p>

          <button
            type="button"
            className="btn-primary w-full"
            disabled={!escolhido}
            onClick={() => escolhido && onConfirmar(escolhido)}
          >
            Confirmar esta NCM e continuar
          </button>
        </div>
      )}

      {resposta && candidatos.length === 0 && !resposta.proximaPergunta && (
        <div className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-sm text-warn-text">
          Nenhuma classificação oficial correspondeu. Detalhe mais o produto ou informe a NCM
          diretamente na aba ao lado.
        </div>
      )}
    </div>
  );
}
