/**
 * PTAX — Banco Central do Brasil (API Olinda).
 *
 * É a fonte FISCAL: para valoração aduaneira, a taxa aplicável é a PTAX de
 * venda do último dia útil anterior ao registro da DI. A Fase 1 usava a
 * cotação de mercado do instante da consulta, o que não é apenas menos
 * resiliente — é a taxa errada para compor a base de cálculo.
 *
 * Não há cotação em fins de semana e feriados, então a busca anda para trás
 * até encontrar um boletim publicado.
 */

import { paraFormatoBcb, paraIsoData, type Cotacao } from "./tipos";

const BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";
const MAX_DIAS_RETROCESSO = 8;

interface LinhaPtax {
  cotacaoCompra?: number;
  cotacaoVenda?: number;
  dataHoraCotacao?: string;
  tipoBoletim?: string;
}

function urlDolar(dataBcb: string): string {
  return (
    `${BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)` +
    `?@dataCotacao='${dataBcb}'&$format=json`
  );
}

function urlMoeda(moeda: string, dataBcb: string): string {
  return (
    `${BASE}/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)` +
    `?@moeda='${moeda}'&@dataCotacao='${dataBcb}'&$format=json`
  );
}

async function buscarDia(moeda: string, dia: Date): Promise<Cotacao | null> {
  const dataBcb = paraFormatoBcb(dia);
  const url = moeda === "USD" ? urlDolar(dataBcb) : urlMoeda(moeda, dataBcb);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`PTAX respondeu ${res.status}`);

  const data = (await res.json()) as { value?: LinhaPtax[] };
  const linhas = data.value ?? [];
  if (linhas.length === 0) return null; // dia sem boletim (fim de semana/feriado)

  // Moedas não-USD retornam vários boletins no dia (Abertura, Intermediário,
  // Fechamento). O relevante é o último — o fechamento.
  const linha = linhas[linhas.length - 1];
  const rate = linha.cotacaoVenda;
  if (!Number.isFinite(rate) || !rate || rate <= 0) return null;

  const asOf = linha.dataHoraCotacao
    ? new Date(`${linha.dataHoraCotacao.replace(" ", "T")}Z`).toISOString()
    : dia.toISOString();

  return {
    moeda,
    rate,
    fonte: "bcb-ptax",
    fonteRotulo: `PTAX venda de ${paraIsoData(dia).split("-").reverse().join("/")} — Banco Central`,
    finalidade: "fiscal",
    tipo: "venda",
    asOf,
    dataRef: paraIsoData(dia),
    stale: false,
    avisos: [],
  };
}

/**
 * Busca a PTAX de venda, andando para trás até achar um dia com boletim.
 * `aPartirDe` deve ser o dia útil anterior à data de referência.
 */
export async function buscarPtax(moeda: string, aPartirDe: Date): Promise<Cotacao | null> {
  const cursor = new Date(aPartirDe.getTime());
  let ultimoErro: unknown = null;

  for (let i = 0; i < MAX_DIAS_RETROCESSO; i++) {
    try {
      const c = await buscarDia(moeda, cursor);
      if (c) return c;
    } catch (e) {
      ultimoErro = e;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  if (ultimoErro) throw ultimoErro;
  return null;
}
