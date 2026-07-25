// Contrato comum de provider de LLM — permite trocar o fornecedor sem tocar
// na lógica de negócio (chat de descoberta de NCM).

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

export interface LLMProvider {
  /** Identificador do provider ("mock", "ollama", "anthropic"). */
  readonly name: string;
  /**
   * false para o provider `mock` (sem chamada de rede) — o classifier usa
   * as regras determinísticas embutidas nesse caso.
   */
  readonly usaLLM: boolean;
  complete(messages: LLMMessage[], opts?: LLMCompleteOptions): Promise<string>;
}
