/**
 * Custo por operação de IA (RNF-5).
 *
 * Dois modelos de cobrança convivem, e tratá-los como um só produz número
 * errado:
 *
 *   POR TOKEN (Anthropic, Gemini) — custo = tokens × preço. Calculável no
 *   momento da chamada.
 *
 *   ASSINATURA (Ollama Cloud) — mensalidade fixa com limite de GPU-time, sem
 *   preço por token publicado. O custo por simulação só existe RATEANDO a
 *   mensalidade pelo volume do mês, e portanto não é conhecido na hora da
 *   chamada: depende de quantas chamadas ainda virão.
 *
 * Por isso o evento guarda o que é FATO (tokens, provider, modelo) e o custo
 * fica nulo quando não é calculável. `null` significa desconhecido — nunca 0,
 * que é um custo de verdade. É o mesmo princípio das alíquotas.
 *
 * Preços vêm de env porque mudam sem aviso e variam por contrato; nada é
 * chutado no código.
 */

export type ModeloCusto = "porToken" | "assinatura" | "naoConfigurado";

export interface PrecoPorToken {
  tipo: "porToken";
  entradaUsdPorMilhao: number;
  saidaUsdPorMilhao: number;
}

export interface PrecoAssinatura {
  tipo: "assinatura";
  mensalidadeUsd: number;
}

export type Preco = PrecoPorToken | PrecoAssinatura | { tipo: "naoConfigurado" };

/**
 * LLM_PRECOS — JSON mapeando modelo (ou provider) para o preço.
 *
 *   {
 *     "gpt-oss:120b":    { "assinaturaUsdMes": 20 },
 *     "claude-sonnet-5": { "entradaUsdMilhao": 3, "saidaUsdMilhao": 15 },
 *     "gemini":          { "entradaUsdMilhao": 0.3, "saidaUsdMilhao": 2.5 }
 *   }
 *
 * A busca é por modelo exato primeiro, depois pelo nome do provider.
 */
interface EntradaConfig {
  entradaUsdMilhao?: number;
  saidaUsdMilhao?: number;
  assinaturaUsdMes?: number;
}

let cacheConfig: Record<string, EntradaConfig> | null = null;

function lerConfig(): Record<string, EntradaConfig> {
  if (cacheConfig) return cacheConfig;
  const bruto = process.env.LLM_PRECOS;
  if (!bruto) return (cacheConfig = {});
  try {
    const parsed = JSON.parse(bruto) as Record<string, EntradaConfig>;
    return (cacheConfig = parsed && typeof parsed === "object" ? parsed : {});
  } catch {
    console.warn("LLM_PRECOS não é um JSON válido — custo de IA ficará sem preço.");
    return (cacheConfig = {});
  }
}

/** Só para testes: descarta o cache de configuração. */
export function _limparCachePrecos() {
  cacheConfig = null;
}

export function precoDe(provider: string, model: string): Preco {
  const cfg = lerConfig();
  const e = cfg[model] ?? cfg[provider];
  if (!e) return { tipo: "naoConfigurado" };

  if (typeof e.assinaturaUsdMes === "number" && e.assinaturaUsdMes >= 0) {
    return { tipo: "assinatura", mensalidadeUsd: e.assinaturaUsdMes };
  }
  if (typeof e.entradaUsdMilhao === "number" && typeof e.saidaUsdMilhao === "number") {
    return {
      tipo: "porToken",
      entradaUsdPorMilhao: e.entradaUsdMilhao,
      saidaUsdPorMilhao: e.saidaUsdMilhao,
    };
  }
  return { tipo: "naoConfigurado" };
}

/** Custo da chamada em USD, ou null quando não é calculável na hora. */
export function custoUsdDaChamada(
  preco: Preco,
  inputTokens?: number,
  outputTokens?: number,
): number | null {
  if (preco.tipo !== "porToken") return null;
  if (inputTokens == null && outputTokens == null) return null;

  const entrada = ((inputTokens ?? 0) / 1_000_000) * preco.entradaUsdPorMilhao;
  const saida = ((outputTokens ?? 0) / 1_000_000) * preco.saidaUsdPorMilhao;
  return entrada + saida;
}

/** Converte USD para centavos de BRL. Arredonda para cima: custo não some. */
export function usdParaCentavosBrl(usd: number, taxaBrl: number): number {
  return Math.ceil(usd * taxaBrl * 100);
}

/**
 * Rateio da assinatura sobre o volume do mês — o custo por operação de um
 * provider que cobra mensalidade fixa.
 */
export function ratearAssinatura(
  mensalidadeUsd: number,
  chamadasNoMes: number,
  taxaBrl: number,
): number | null {
  if (chamadasNoMes <= 0) return null;
  return usdParaCentavosBrl(mensalidadeUsd / chamadasNoMes, taxaBrl);
}
