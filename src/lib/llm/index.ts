// Seletor de provider de LLM — escolhido por env LLM_PROVIDER.
//   mock (padrão) | ollama | anthropic | gemini

import { createAnthropicProvider } from "@/lib/llm/anthropic";
import { createGeminiProvider } from "@/lib/llm/gemini";
import { mockProvider } from "@/lib/llm/mock";
import { createOllamaProvider } from "@/lib/llm/ollama";
import type { LLMProvider } from "@/lib/llm/types";

export function getLLMProvider(): LLMProvider {
  const which = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  switch (which) {
    case "ollama":
      return createOllamaProvider();
    case "anthropic":
      return createAnthropicProvider();
    case "gemini":
      return createGeminiProvider();
    case "mock":
    default:
      return mockProvider;
  }
}

export type { LLMMessage, LLMProvider } from "@/lib/llm/types";
