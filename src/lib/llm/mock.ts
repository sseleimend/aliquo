import type { LLMProvider } from "@/lib/llm/types";

// Provider `mock` — não faz chamada de rede. Sinaliza `usaLLM = false` para
// que o classifier (lib/ncm/classifier.ts) use suas regras determinísticas.
// Roda sem nenhuma chave de API.
export const mockProvider: LLMProvider = {
  name: "mock",
  usaLLM: false,
  async complete(): Promise<string> {
    return "";
  },
};
