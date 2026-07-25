"use client";

import { useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { normalizeNcm } from "@/lib/ncm/dataset";
import type { Candidato, NcmChatResponse } from "@/lib/ncm/chat-types";

type Msg = { autor: "user" | "ia"; texto: string; nota?: string };

export function ChatNcm({
  onConfirmar,
}: {
  onConfirmar: (ncm: string, descricao?: string) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [respostas, setRespostas] = useState<string[]>([]);
  const [entrada, setEntrada] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [resp, setResp] = useState<NcmChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  async function chamar(novaDescricao: string, novasRespostas: string[]) {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch("/api/ncm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: novaDescricao, respostas: novasRespostas }),
      });
      const data = (await r.json()) as NcmChatResponse & { error?: string };
      if (!r.ok) {
        setErro(data.error ?? "Falha ao consultar.");
        return;
      }
      setResp(data);
      const iaMsgs: Msg[] = [];
      if (data.candidatos) {
        iaMsgs.push({
          autor: "ia",
          texto: data.aviso
            ? data.aviso
            : `Tenho ${data.candidatos.length} candidato(s) de NCM. Escolha e confirme abaixo.`,
          nota: data.reformulacao,
        });
      } else if (data.proximaPergunta) {
        iaMsgs.push({ autor: "ia", texto: data.proximaPergunta, nota: data.reformulacao });
      }
      setMsgs((m) => [...m, ...iaMsgs]);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function iniciar() {
    if (descricao.trim().length < 2) return;
    setIniciado(true);
    setMsgs([{ autor: "user", texto: descricao.trim() }]);
    await chamar(descricao.trim(), []);
  }

  async function responder() {
    if (!entrada.trim()) return;
    const novas = [...respostas, entrada.trim()];
    setRespostas(novas);
    setMsgs((m) => [...m, { autor: "user", texto: entrada.trim() }]);
    setEntrada("");
    await chamar(descricao.trim(), novas);
  }

  function confirmar() {
    const escolhido = selecionado ?? (manual ? normalizeNcm(manual) : null);
    if (!escolhido) return;
    onConfirmar(escolhido, descricao.trim() || undefined);
  }

  const manualValido = normalizeNcm(manual).replace(/\D/g, "").length === 8;

  if (!iniciado) {
    return (
      <div className="space-y-3">
        <label className="label" htmlFor="descricao">
          Descreva o produto (RF02)
        </label>
        <textarea
          id="descricao"
          className="input min-h-[110px]"
          placeholder="Ex.: cabo USB-C de nylon trançado para carregar celular, 2 metros..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <p className="text-xs text-muted">
          A IA reformula sua descrição em termos técnicos e faz até 5 perguntas para sugerir
          candidatos de NCM.
        </p>
        <button className="btn-primary" onClick={iniciar} disabled={descricao.trim().length < 2}>
          Iniciar descoberta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transcrição */}
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-line bg-page p-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.autor === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.autor === "user"
                  ? "bg-accent text-white"
                  : "border border-line bg-white text-ink"
              }`}
            >
              {m.texto}
              {m.nota ? (
                <div
                  className={`mt-1 text-[11px] ${
                    m.autor === "user" ? "text-white/70" : "text-muted"
                  }`}
                >
                  🔎 {m.nota}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? <div className="text-sm text-muted">IA analisando…</div> : null}
      </div>

      {erro ? (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger-text">{erro}</p>
      ) : null}

      {/* Pergunta de refino em aberto */}
      {resp && !resp.candidatos && resp.proximaPergunta ? (
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Sua resposta…"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && responder()}
            disabled={loading}
          />
          <button className="btn-primary" onClick={responder} disabled={loading || !entrada.trim()}>
            Enviar
          </button>
        </div>
      ) : null}

      {/* Candidatos */}
      {resp?.candidatos ? (
        <div className="space-y-3">
          <DisclaimerBanner texto={resp.disclaimer} />
          {resp.atingiuTeto ? (
            <p className="text-xs text-warn-text">
              Teto de 5 perguntas atingido — exibindo os melhores candidatos disponíveis (RF04).
            </p>
          ) : null}

          <div className="space-y-2">
            {resp.candidatos.map((c: Candidato) => (
              <label
                key={c.ncm}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selecionado === c.ncm
                    ? "border-accent-border bg-accent-bg"
                    : "border-line bg-white hover:bg-page"
                }`}
              >
                <input
                  type="radio"
                  name="candidato"
                  className="mt-1"
                  checked={selecionado === c.ncm}
                  onChange={() => {
                    setSelecionado(c.ncm);
                    setManual("");
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{c.ncm}</span>
                    {c.fonte === "ia" ? (
                      <span className="badge bg-accent-bg text-accent-text">Sugerido pela IA</span>
                    ) : null}
                  </div>
                  <div className="text-sm text-ink2">{c.descricao}</div>
                  <div className="mt-1 text-xs text-muted">{c.categoria}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-line p-3">
            <label className="label" htmlFor="manual">
              Ou corrija manualmente o NCM (RF06)
            </label>
            <input
              id="manual"
              className="input font-mono"
              placeholder="0000.00.00"
              value={manual}
              onChange={(e) => {
                setManual(normalizeNcm(e.target.value));
                setSelecionado(null);
              }}
            />
          </div>

          <button
            className="btn-primary w-full"
            onClick={confirmar}
            disabled={!selecionado && !manualValido}
          >
            Confirmar NCM e continuar
          </button>
        </div>
      ) : null}
    </div>
  );
}
