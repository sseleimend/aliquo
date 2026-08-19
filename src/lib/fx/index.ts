/**
 * Câmbio resiliente (RF-C1, RNF-3).
 *
 * A Fase 1 quebrava por rate limit e, pior, degradava em silêncio para taxas
 * de amostra. A cadeia agora é explícita e cada degrau deixa rastro:
 *
 *   1. cache em memória (mesma requisição / mesmo processo)
 *   2. cache em BANCO, fresco             -> sobrevive a cold start
 *   3. fonte primária                      -> PTAX (fiscal) / AwesomeAPI (mercado)
 *   4. fonte secundária                    -> a outra, marcada como substituta
 *   5. cache em banco, OBSOLETO            -> devolvido com aviso alto e stale=true
 *   6. erro explícito                      -> UI exige a taxa manualmente
 *
 * Em nenhum ponto uma taxa é inventada.
 */

import { prisma } from "@/lib/db";
import { buscarAwesome } from "./awesomeapi";
import { buscarPtax } from "./ptax";
import {
  CambioIndisponivelError,
  diaUtilAnterior,
  MOEDAS_SUPORTADAS,
  paraIsoData,
  type Cotacao,
  type FinalidadeCambio,
} from "./tipos";

export * from "./tipos";

const TTL_MERCADO_MS = 10 * 60 * 1000;
const memoria = new Map<string, { cotacao: Cotacao; expira: number }>();

const chaveMem = (m: string, f: FinalidadeCambio, d: string) => `${m}|${f}|${d}`;

function real(moeda: string, finalidade: FinalidadeCambio): Cotacao {
  const hoje = paraIsoData(new Date());
  return {
    moeda: "BRL",
    rate: 1,
    fonte: "interno",
    fonteRotulo: "Moeda nacional",
    finalidade,
    tipo: "paridade",
    asOf: new Date().toISOString(),
    dataRef: hoje,
    stale: false,
    avisos: [],
  };
}

async function gravarCache(c: Cotacao): Promise<string | null> {
  try {
    const linha = await prisma.fxCotacao.upsert({
      where: {
        moeda_fonte_finalidade_dataRef: {
          moeda: c.moeda,
          fonte: c.fonte,
          finalidade: c.finalidade,
          dataRef: c.dataRef,
        },
      },
      update: { rate: c.rate, asOf: new Date(c.asOf), fetchedAt: new Date(), tipo: c.tipo },
      create: {
        moeda: c.moeda,
        fonte: c.fonte,
        finalidade: c.finalidade,
        dataRef: c.dataRef,
        rate: c.rate,
        tipo: c.tipo,
        asOf: new Date(c.asOf),
      },
    });
    return linha.id;
  } catch {
    // Cache é otimização: falha aqui não pode derrubar a simulação.
    return null;
  }
}

async function lerCache(
  moeda: string,
  finalidade: FinalidadeCambio,
  dataRef?: string,
): Promise<Cotacao | null> {
  try {
    const linha = await prisma.fxCotacao.findFirst({
      where: { moeda, finalidade, ...(dataRef ? { dataRef } : {}) },
      orderBy: [{ dataRef: "desc" }, { fetchedAt: "desc" }],
    });
    if (!linha) return null;

    const idadeHoras = (Date.now() - linha.fetchedAt.getTime()) / 3_600_000;
    return {
      moeda: linha.moeda,
      rate: linha.rate,
      fonte: linha.fonte,
      fonteRotulo:
        linha.fonte === "bcb-ptax"
          ? `PTAX venda de ${linha.dataRef.split("-").reverse().join("/")} — Banco Central`
          : "Câmbio comercial (AwesomeAPI)",
      finalidade: linha.finalidade as FinalidadeCambio,
      tipo: linha.tipo,
      asOf: linha.asOf.toISOString(),
      dataRef: linha.dataRef,
      stale: false,
      idadeHoras,
      avisos: [],
    };
  } catch {
    return null;
  }
}

export interface OpcoesCotacao {
  moeda: string;
  finalidade?: FinalidadeCambio;
  /** Data de referência da importação; default = hoje. */
  dataReferencia?: Date;
}

export async function getCotacao(opts: OpcoesCotacao): Promise<Cotacao> {
  const moeda = (opts.moeda || "USD").toUpperCase();
  const finalidade = opts.finalidade ?? "fiscal";

  if (moeda === "BRL") return real(moeda, finalidade);

  const alvo = finalidade === "fiscal" ? diaUtilAnterior(opts.dataReferencia) : new Date();
  const dataRef = paraIsoData(alvo);

  // 1) memória
  const mem = memoria.get(chaveMem(moeda, finalidade, dataRef));
  if (mem && mem.expira > Date.now()) return mem.cotacao;

  // 2) banco, fresco
  const cached = await lerCache(moeda, finalidade, finalidade === "fiscal" ? dataRef : undefined);
  const frescoBastante =
    cached &&
    (finalidade === "fiscal"
      ? cached.dataRef === dataRef
      : (cached.idadeHoras ?? 99) * 3_600_000 < TTL_MERCADO_MS);
  if (cached && frescoBastante) {
    memoria.set(chaveMem(moeda, finalidade, dataRef), {
      cotacao: cached,
      expira: Date.now() + TTL_MERCADO_MS,
    });
    return cached;
  }

  const avisos: string[] = [];

  // 3) fonte primária + 4) secundária
  const tentativas: Array<() => Promise<Cotacao | null>> =
    finalidade === "fiscal"
      ? [() => buscarPtax(moeda, alvo), () => buscarAwesome(moeda, "fiscal")]
      : [() => buscarAwesome(moeda, "mercado"), () => buscarPtax(moeda, alvo)];

  for (const tentar of tentativas) {
    try {
      const c = await tentar();
      if (c) {
        const cotacao = { ...c, finalidade, avisos: [...avisos, ...c.avisos] };
        await gravarCache(cotacao);
        memoria.set(chaveMem(moeda, finalidade, dataRef), {
          cotacao,
          expira: Date.now() + TTL_MERCADO_MS,
        });
        return cotacao;
      }
    } catch (e) {
      avisos.push(
        `Fonte de câmbio indisponível: ${e instanceof Error ? e.message : "erro desconhecido"}.`,
      );
    }
  }

  // 5) cache obsoleto — melhor um número honesto e datado do que nenhum
  const qualquer = await lerCache(moeda, finalidade);
  if (qualquer) {
    const idade = Math.round(qualquer.idadeHoras ?? 0);
    return {
      ...qualquer,
      stale: true,
      avisos: [
        ...avisos,
        `Nenhuma fonte de câmbio respondeu. Usando a última cotação conhecida, de ` +
          `${qualquer.dataRef} (${idade}h atrás). Confirme antes de decidir.`,
      ],
    };
  }

  // 6) sem saída honesta
  throw new CambioIndisponivelError(moeda);
}

/** Cotação de mercado para exibição junto da fiscal. */
export async function getCotacaoMercado(moeda: string): Promise<Cotacao | null> {
  try {
    return await getCotacao({ moeda, finalidade: "mercado" });
  } catch {
    return null;
  }
}

export function moedasSuportadas(): readonly string[] {
  return MOEDAS_SUPORTADAS;
}

/** Só para testes: limpa o cache em memória. */
export function _limparCacheMemoria() {
  memoria.clear();
}
