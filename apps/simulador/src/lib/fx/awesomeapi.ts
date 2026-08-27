/**
 * AwesomeAPI — cotação de MERCADO em tempo real.
 *
 * Serve para mostrar ao usuário o câmbio comercial de agora (contexto de
 * compra da moeda) e como fonte substituta quando a PTAX não responde.
 *
 * Mudança importante em relação à Fase 1: este módulo NÃO tem mais fallback
 * para taxas de amostra. Antes, uma falha aqui devolvia silenciosamente um
 * valor inventado rotulado `awesomeapi(fallback→mock)`, que a UI reduzia a
 * "(simulado)" — e assim um número fictício chegava ao PDF. Agora falha é
 * falha, e quem decide o que fazer é a cadeia em index.ts.
 */

import { paraIsoData, type Cotacao, type FinalidadeCambio } from "./tipos";

interface RespostaAwesome {
  ask?: string;
  bid?: string;
  timestamp?: string;
}

export async function buscarAwesome(
  moeda: string,
  finalidade: FinalidadeCambio = "mercado",
): Promise<Cotacao> {
  const code = moeda.toUpperCase();
  const res = await fetch(`https://economia.awesomeapi.com.br/last/${code}-BRL`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const data = (await res.json()) as Record<string, RespostaAwesome | undefined>;
  const q = data[`${code}BRL`];
  // `ask` é o preço de venda — o mais próximo do custo de comprar a moeda.
  const rate = Number.parseFloat(q?.ask ?? q?.bid ?? "");
  if (!q || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Cotação inválida para ${code}`);
  }

  const asOfDate = q.timestamp ? new Date(Number(q.timestamp) * 1000) : new Date();

  return {
    moeda: code,
    rate,
    fonte: "awesomeapi",
    fonteRotulo: "Câmbio comercial (AwesomeAPI)",
    finalidade,
    tipo: "ask",
    asOf: asOfDate.toISOString(),
    dataRef: paraIsoData(asOfDate),
    stale: false,
    avisos:
      finalidade === "fiscal"
        ? [
            "Cotação de mercado usada como substituta da PTAX — a fonte oficial " +
              "do Banco Central não respondeu.",
          ]
        : [],
  };
}
