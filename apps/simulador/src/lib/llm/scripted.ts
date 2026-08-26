import { respostaVazia, type LLMMessage, type LLMProvider, type LLMResposta } from "@/lib/llm/types";

/**
 * Provider de teste: devolve respostas enfileiradas, na ordem.
 *
 * Existe para tornar o classificador testável de forma determinística — em
 * especial para provar o invariante central do RF-A1: um código que a IA
 * invente e que não esteja no conjunto recuperado precisa ser DESCARTADO.
 * Sem isso, essa garantia só seria verificável contra uma API real.
 */
export function createScriptedProvider(respostas: string[]): LLMProvider & {
  chamadas: LLMMessage[][];
} {
  const fila = [...respostas];
  const chamadas: LLMMessage[][] = [];

  return {
    name: "scripted",
    usaLLM: true,
    chamadas,
    async complete(messages: LLMMessage[]): Promise<LLMResposta> {
      chamadas.push(messages);
      const texto = fila.shift();
      if (texto === undefined) return respostaVazia("scripted");
      if (texto === "__ERRO__") throw new Error("falha simulada do provider");
      return {
        texto,
        provider: "scripted",
        model: "scripted",
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}
