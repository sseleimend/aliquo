// Camada de câmbio (FX) — SUBSTITUÍVEL.
// Fonte de cotação automática é dependência técnica em aberto (PRD §11).
// Trocar de provider = mudar FX_PROVIDER no .env e adicionar um arquivo aqui.

import { mockFxProvider } from "@/lib/fx/mock";
import { awesomeApiFxProvider } from "@/lib/fx/awesomeapi";

export interface FxQuote {
  currency: string;
  /** 1 unidade da moeda = `rate` BRL. */
  rate: number;
  provider: string;
  asOf: string;
  /** true quando a taxa é de amostra/simulada. */
  simulado: boolean;
}

export interface FxProvider {
  getRate(currency: string): Promise<FxQuote>;
  listSupported(): string[];
}

export function getFxProvider(): FxProvider {
  const which = (process.env.FX_PROVIDER || "awesomeapi").toLowerCase();
  switch (which) {
    case "mock":
      return mockFxProvider;
    case "awesomeapi":
    case "real":
    default:
      return awesomeApiFxProvider;
  }
}

export async function getExchangeRate(currency: string): Promise<FxQuote> {
  return getFxProvider().getRate(currency);
}
