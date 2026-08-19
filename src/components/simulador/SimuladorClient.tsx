"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { limparRascunhoSalvo, SimuladorProvider, useSimulador } from "./SimuladorProvider";
import { carregarDeDuplicata } from "./duplicar";
import {
  PASSOS,
  paraPayload,
  passoAcessivel,
  podeAvancar,
  todosConfirmados,
  type ModoUso,
} from "./rascunho";
import { Passo1Produto } from "./passos/Passo1Produto";
import { Passo2Ncm } from "./passos/Passo2Ncm";
import { Passo3Itens } from "./passos/Passo3Itens";
import { Passo4FreteSeguro } from "./passos/Passo4FreteSeguro";
import { Passo5Custos } from "./passos/Passo5Custos";
import { Passo6Revisao } from "./passos/Passo6Revisao";

export function SimuladorClient({
  baseAto,
  duplicarDe,
  comecarLimpo,
}: {
  baseAto?: string;
  duplicarDe?: string;
  comecarLimpo?: boolean;
}) {
  return (
    <SimuladorProvider
      ignorarRascunhoSalvo={Boolean(duplicarDe) || Boolean(comecarLimpo)}
      limparRascunho={Boolean(comecarLimpo)}
    >
      <Conteudo baseAto={baseAto} duplicarDe={duplicarDe} />
    </SimuladorProvider>
  );
}

/**
 * Passos exibidos no stepper.
 *
 * No modo rápido, valores/frete/custos aparecem numa página só — então eles
 * precisam ser UM item no stepper. Mantê-los como três botões que abrem
 * exatamente o mesmo formulário é o que fazia o usuário achar que a navegação
 * estava quebrada. O passo interno continua 0..5; só a apresentação colapsa.
 */
function passosExibidos(rapido: boolean): Array<{ rotulo: string; de: number; ate: number }> {
  if (!rapido) return PASSOS.map((rotulo, i) => ({ rotulo, de: i, ate: i }));
  return [
    { rotulo: PASSOS[0], de: 0, ate: 0 },
    { rotulo: PASSOS[1], de: 1, ate: 1 },
    { rotulo: "Dados da importação", de: 2, ate: 4 },
    { rotulo: PASSOS[5], de: 5, ate: 5 },
  ];
}

function Conteudo({ baseAto, duplicarDe }: { baseAto?: string; duplicarDe?: string }) {
  const { estado, despachar } = useSimulador();
  const ultimo = PASSOS.length - 1;
  const [avisoDuplicata, setAvisoDuplicata] = useState<string | null>(null);
  const jaDuplicou = useRef<string | null>(null);

  // RF-D4 — carrega uma importação anterior como rascunho, pelo mesmo caminho
  // que o seletor do passo 1 usa.
  useEffect(() => {
    if (!duplicarDe || jaDuplicou.current === duplicarDe) return;
    jaDuplicou.current = duplicarDe;

    (async () => {
      despachar({ tipo: "carregando", carregando: true });
      const r = await carregarDeDuplicata(duplicarDe, despachar);
      if (!r.ok) despachar({ tipo: "erro", erro: r.erro });
      else setAvisoDuplicata(r.aviso ?? null);
      despachar({ tipo: "carregando", carregando: false });
    })();
  }, [duplicarDe, despachar]);

  const calcular = useCallback(async () => {
    despachar({ tipo: "carregando", carregando: true });
    try {
      const res = await fetch("/api/importacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paraPayload(estado)),
      });
      const data = await res.json();
      if (!res.ok) {
        despachar({ tipo: "erro", erro: data.error ?? "Falha ao calcular." });
        return;
      }
      despachar({ tipo: "resultado", resultado: data.resultado, importacaoId: data.id });
    } catch {
      despachar({ tipo: "erro", erro: "Não foi possível calcular. Verifique a conexão." });
    }
  }, [estado, despachar]);

  const rapido = estado.modo === "rapido";

  return (
    <div className="space-y-6">
      {/* ---- Cabeçalho e alternância de ritmo ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Nova simulação</h1>
          <p className="text-sm text-muted">
            Da classificação ao custo total, com a base oficial sempre à vista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            // Cores do botão do histórico; `self-stretch` faz a altura
            // acompanhar o seletor de ritmo ao lado sem depender de um padding
            // chutado que quebraria se aquele componente mudar.
            className="btn-primary !px-3 !py-1 text-xs self-stretch"
            onClick={() => {
              limparRascunhoSalvo();
              despachar({ tipo: "reset" });
            }}
          >
            Nova simulação
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            {(["guiado", "rapido"] as ModoUso[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => despachar({ tipo: "modo", modo: m })}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                estado.modo === m ? "bg-accent text-white" : "text-ink2 hover:bg-page"
              }`}
            >
                {m === "guiado" ? "Guiado" : "Modo rápido"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Stepper ---- */}
      <ol className="flex flex-wrap gap-1.5">
        {passosExibidos(rapido).map((p, i) => {
          const ativo = estado.passo >= p.de && estado.passo <= p.ate;
          const feito = estado.passo > p.ate;
          const acessivel = passoAcessivel(estado, p.de);
          return (
            <li key={p.rotulo}>
              <button
                type="button"
                disabled={!acessivel}
                onClick={() => despachar({ tipo: "passo", passo: p.de })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  ativo
                    ? "bg-accent text-white"
                    : feito
                      ? "bg-teal-bg text-teal-text"
                      : acessivel
                        ? "bg-white text-ink2 hover:bg-page"
                        : "bg-page text-muted opacity-60"
                }`}
              >
                <span className="mr-1 font-mono">{feito ? "✓" : i + 1}</span>
                {p.rotulo}
              </button>
            </li>
          );
        })}
      </ol>

      {avisoDuplicata && estado.duplicadaDeId && (
        <div className="rounded-lg border border-accent-border bg-accent-bg px-3 py-2 text-sm text-accent-text">
          <strong>Duplicando uma importação anterior.</strong> {avisoDuplicata}
        </div>
      )}

      {estado.passo < ultimo && <DisclaimerBanner />}

      {estado.erro && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {estado.erro}
        </div>
      )}

      {/* ---- Corpo ----
          No modo rápido, os passos 3 a 5 (valores, frete, custos) aparecem
          numa página só. São exatamente os mesmos componentes — muda o
          invólucro, não o fluxo. */}
      <div className="card p-5">
        {estado.passo === 0 && <Passo1Produto baseAto={baseAto} />}
        {estado.passo === 1 && <Passo2Ncm baseAto={baseAto} />}

        {rapido && estado.passo >= 2 && estado.passo <= 4 ? (
          <div className="space-y-8">
            <Secao titulo="Valores e quantidades">
              <Passo3Itens />
            </Secao>
            <Secao titulo="Frete e seguro">
              <Passo4FreteSeguro />
            </Secao>
            <Secao titulo="Custos variáveis">
              <Passo5Custos />
            </Secao>
          </div>
        ) : (
          <>
            {estado.passo === 2 && <Passo3Itens />}
            {estado.passo === 3 && <Passo4FreteSeguro />}
            {estado.passo === 4 && <Passo5Custos />}
          </>
        )}

        {estado.passo === ultimo && <Passo6Revisao />}
      </div>

      {/* ---- Navegação ---- */}
      {estado.passo < ultimo && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={estado.passo === 0}
            onClick={() =>
              // No modo rápido os passos 2-4 são uma tela só: voltar de dentro
              // dela tem que sair da faixa inteira, não repetir a mesma página.
              rapido && estado.passo >= 2 && estado.passo <= 4
                ? despachar({ tipo: "passo", passo: 1 })
                : despachar({ tipo: "voltar" })
            }
          >
            Voltar
          </button>

          {(rapido && estado.passo >= 2) || estado.passo === 4 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={estado.carregando || !todosConfirmados(estado)}
              onClick={calcular}
            >
              {estado.carregando ? "Calculando…" : "Calcular custo total"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={!podeAvancar(estado)}
              onClick={() => despachar({ tipo: "avancar" })}
            >
              Continuar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 border-b border-line pb-2 text-sm font-bold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}
