import type { FxProvider, FxQuote } from "@/lib/fx/index";
import { mockFxProvider } from "@/lib/fx/mock";

// Provider de câmbio REAL — AwesomeAPI (economia.awesomeapi.com.br), fonte
// brasileira gratuita e sem chave. Usa a cotação de venda (ask), que é a mais
// próxima do custo de comprar moeda estrangeira para importação.

const SUPORTADAS = ["USD", "EUR", "CNY", "GBP", "JPY", "CHF", "CAD", "AUD", "MXN"];
const TTL_MS = 10 * 60 * 1000; // cache de 10 min por moeda

const cache = new Map<string, { quote: FxQuote; expira: number }>();

async function buscarReal(code: string): Promise<FxQuote> {
  const res = await fetch(`https://economia.awesomeapi.com.br/last/${code}-BRL`, {
    // Sempre buscar a cotação mais recente (o cache é controlado aqui).
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const data = (await res.json()) as Record<
    string,
    { ask?: string; bid?: string; timestamp?: string }
  >;
  const q = data[`${code}BRL`];
  const rate = parseFloat(q?.ask ?? q?.bid ?? "");
  if (!q || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Cotação inválida para ${code}`);
  }

  return {
    currency: code,
    rate,
    provider: "awesomeapi",
    asOf: q.timestamp
      ? new Date(Number(q.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
    simulado: false,
  };
}

export const awesomeApiFxProvider: FxProvider = {
  async getRate(currency: string): Promise<FxQuote> {
    const code = (currency || "USD").toUpperCase();
    if (code === "BRL") {
      return {
        currency: "BRL",
        rate: 1,
        provider: "awesomeapi",
        asOf: new Date().toISOString(),
        simulado: false,
      };
    }

    const cached = cache.get(code);
    if (cached && cached.expira > Date.now()) return cached.quote;

    try {
      const quote = await buscarReal(code);
      cache.set(code, { quote, expira: Date.now() + TTL_MS });
      return quote;
    } catch (err) {
      console.error("Falha no câmbio real, usando fallback simulado:", err);
      // Degradação graciosa: cai para a taxa de amostra, marcada como simulada.
      const fb = await mockFxProvider.getRate(code);
      return { ...fb, provider: "awesomeapi(fallback→mock)" };
    }
  },
  listSupported() {
    return SUPORTADAS;
  },
};
