import type { FxProvider, FxQuote } from "@/lib/fx/index";

// Taxas de amostra (BRL por 1 unidade da moeda) — PROTÓTIPO, não são cotações reais.
const SAMPLE_RATES: Record<string, number> = {
  BRL: 1.0,
  USD: 5.45,
  EUR: 5.9,
  CNY: 0.76,
  GBP: 6.9,
  JPY: 0.037,
  CHF: 6.1,
  CAD: 4.0,
  AUD: 3.6,
  MXN: 0.3,
};

export const mockFxProvider: FxProvider = {
  async getRate(currency: string): Promise<FxQuote> {
    const code = (currency || "USD").toUpperCase();
    const rate = SAMPLE_RATES[code] ?? SAMPLE_RATES.USD;
    return {
      currency: code,
      rate,
      provider: "mock",
      asOf: new Date().toISOString(),
      simulado: true,
    };
  },
  listSupported() {
    return Object.keys(SAMPLE_RATES);
  },
};
