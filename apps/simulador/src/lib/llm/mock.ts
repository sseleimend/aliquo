import { respostaVazia, type LLMProvider, type LLMResposta } from "@/lib/llm/types";

// Provider `mock` — não faz chamada de rede. Sinaliza `usaLLM = false` para
// que o chamador degrade para a busca determinística. Roda sem nenhuma chave.
export const mockProvider: LLMProvider = {
  name: "mock",
  usaLLM: false,
  async complete(): Promise<LLMResposta> {
    return respostaVazia("mock");
  },
};
