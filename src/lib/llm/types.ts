// Contrato comum de provider de LLM — permite trocar o fornecedor sem tocar
// na lógica de negócio (descoberta de NCM).

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompleteOptions {
  temperature?: number;
  maxTokens?: number;
  /** Pede resposta em JSON quando o provider suportar. */
  json?: boolean;
}

/**
 * Resposta do provider.
 *
 * Carrega o uso de tokens porque o RNF-5 exige medir o custo por operação —
 * e sem isso na assinatura o dado se perde no momento em que é gerado.
 */
export interface LLMResposta {
  texto: string;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMProvider {
  /** Identificador do provider ("mock", "ollama", "anthropic", "gemini"). */
  readonly name: string;
  /** false para `mock`/`scripted` sem rede — o chamador degrada para busca pura. */
  readonly usaLLM: boolean;
  complete(messages: LLMMessage[], opts?: LLMCompleteOptions): Promise<LLMResposta>;
}

/** Resposta vazia padronizada, para providers sem rede. */
export function respostaVazia(provider: string): LLMResposta {
  return { texto: "", provider, model: "-", latencyMs: 0 };
}
