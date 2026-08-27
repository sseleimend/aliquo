"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import {
  rascunhoInicial,
  reducer,
  type AcaoRascunho,
  type ModoUso,
  type Rascunho,
} from "./rascunho";

interface ContextoSimulador {
  estado: Rascunho;
  despachar: React.Dispatch<AcaoRascunho>;
}

const Ctx = createContext<ContextoSimulador | null>(null);

const CHAVE_STORAGE = "aliquo:rascunho";
const CHAVE_MODO = "aliquo:modo";

export function SimuladorProvider({
  children,
  modoInicial,
  /** Quando a página abre por um reuso ou por "Nova simulação", não restauramos. */
  ignorarRascunhoSalvo = false,
  /** "Nova simulação": além de não restaurar, apaga o rascunho salvo. */
  limparRascunho = false,
}: {
  children: ReactNode;
  modoInicial?: ModoUso;
  ignorarRascunhoSalvo?: boolean;
  limparRascunho?: boolean;
}) {
  const [estado, despachar] = useReducer(reducer, rascunhoInicial(modoInicial ?? "guiado"));

  // Recupera o rascunho ao voltar para a página. Um cálculo de importação é
  // trabalhoso de montar; perder tudo num refresh é motivo de abandono.
  //
  // Usa `restaurar` (e não `carregar`): a restauração é assíncrona em relação
  // ao carregamento de um reuso e não pode sobrepor o que ele já trouxe.
  useEffect(() => {
    // "Nova simulação" precisa mesmo apagar: sem isso, o rascunho antigo volta
    // no próximo acesso e o usuário encontra campos que achava ter limpado.
    if (limparRascunho) {
      try {
        localStorage.removeItem(CHAVE_STORAGE);
      } catch {
        /* storage indisponível não trava */
      }
      return;
    }
    if (ignorarRascunhoSalvo) return;
    try {
      const modo = localStorage.getItem(CHAVE_MODO) as ModoUso | null;
      if (modo === "rapido" || modo === "guiado") despachar({ tipo: "modo", modo });

      const bruto = localStorage.getItem(CHAVE_STORAGE);
      if (!bruto) return;
      const salvo = JSON.parse(bruto) as Partial<Rascunho>;
      // Resultado não é restaurado: seria mostrar um número calculado com
      // câmbio e base de outro momento.
      if (salvo.itens?.length) {
        despachar({ tipo: "restaurar", rascunho: { ...salvo, resultado: null, importacaoId: null } });
      }
    } catch {
      /* rascunho corrompido não pode travar a página */
    }
  }, [ignorarRascunhoSalvo, limparRascunho]);

  useEffect(() => {
    try {
      const { resultado, carregando, erro, ...persistivel } = estado;
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(persistivel));
      localStorage.setItem(CHAVE_MODO, estado.modo);
    } catch {
      /* storage cheio/indisponível não pode travar o fluxo */
    }
  }, [estado]);

  const valor = useMemo(() => ({ estado, despachar }), [estado]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSimulador(): ContextoSimulador {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSimulador precisa estar dentro de <SimuladorProvider>");
  return ctx;
}

export function limparRascunhoSalvo() {
  try {
    localStorage.removeItem(CHAVE_STORAGE);
  } catch {
    /* ignore */
  }
}
