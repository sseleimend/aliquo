"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { CabecalhoPagina } from "@/components/app/CabecalhoPagina";
import { limparRascunhoSalvo, SimuladorProvider, useSimulador } from "./SimuladorProvider";
import { carregarDeDuplicata } from "./duplicar";
import {
  PASSOS,
  paraPayload,
  passoAcessivel,
  podeAvancar,
  todosConfirmados, erroIcmsDeclarado,
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
 * Passos exibidos na trilha.
 *
 * No modo rápido, valores/frete/custos aparecem numa página só — então eles
 * precisam ser UM item. Manter três marcadores que abrem o mesmo formulário é
 * o que fazia a navegação parecer quebrada. O passo interno continua 0..5.
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
  const trilha = passosExibidos(rapido);

  return (
    <>
      <CabecalhoPagina
        titulo="Simulação de importação"
        descricao="Da classificação ao custo total, com a fonte de cada alíquota à vista."
        acoes={
          <>
            {/* Mesma cor do botão do histórico: é a mesma ação nas duas telas. */}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                limparRascunhoSalvo();
                despachar({ tipo: "reset" });
              }}
            >
              Nova simulação
            </button>

            <div className="flex overflow-hidden rounded border border-fio2">
              {(["guiado", "rapido"] as ModoUso[]).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => despachar({ tipo: "modo", modo: m })}
                  className={`px-3 py-2 text-[12.5px] font-medium leading-none transition-colors ${
                    i > 0 ? "border-l border-fio2" : ""
                  } ${
                    estado.modo === m
                      ? "bg-caneta text-papel"
                      : "bg-folha text-tinta2 hover:bg-papel2"
                  }`}
                >
                  {m === "guiado" ? "Guiado" : "Rápido"}
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* ---- Trilha de passos ----
          Numeração fora do rótulo e régua contínua: é o índice do documento,
          não uma fileira de pílulas. */}
      <ol className="mb-6 flex flex-wrap items-stretch border-b border-fio">
        {trilha.map((p, i) => {
          const ativo = estado.passo >= p.de && estado.passo <= p.ate;
          const feito = estado.passo > p.ate;
          const acessivel = passoAcessivel(estado, p.de);
          return (
            <li key={p.rotulo}>
              <button
                type="button"
                disabled={!acessivel}
                onClick={() => despachar({ tipo: "passo", passo: p.de })}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] transition-colors ${
                  ativo
                    ? "border-b-caneta font-medium text-caneta-forte"
                    : acessivel
                      ? "border-b-transparent text-tinta2 hover:border-b-fio2 hover:text-tinta"
                      : "cursor-not-allowed border-b-transparent text-fraco opacity-55"
                }`}
              >
                <span
                  className={`grid h-[19px] w-[19px] place-items-center rounded-sm border font-mono text-[10.5px] leading-none ${
                    feito
                      ? "border-visto-fio bg-visto-fraca text-visto"
                      : ativo
                        ? "border-caneta bg-caneta text-papel"
                        : "border-fio2 text-fraco"
                  }`}
                >
                  {feito ? "✓" : i + 1}
                </span>
                {p.rotulo}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="space-y-4">
        {avisoDuplicata && estado.duplicadaDeId && (
          <div className="aviso-caneta">
            <strong className="font-semibold">Reusando uma importação anterior.</strong>{" "}
            {avisoDuplicata}
          </div>
        )}

        {estado.passo < ultimo && <DisclaimerBanner />}

        {estado.erro && <div className="aviso-carimbo">{estado.erro}</div>}

        {/* ---- Corpo ---- */}
        <div className="painel">
          <div className="painel-corpo">
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
        </div>

        {/* ---- Navegação ---- */}
        {estado.passo < ultimo && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={estado.passo === 0}
              onClick={() =>
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
                disabled={
                  estado.carregando || !todosConfirmados(estado) || erroIcmsDeclarado(estado) != null
                }
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
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 border-b border-fio pb-2 font-serifa text-[16px] font-semibold text-tinta">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
