import type { LLMCompleteOptions, LLMMessage, LLMProvider } from "@/lib/llm/types";

// Provider Ollama Cloud via endpoint OpenAI-compatível (/v1/chat/completions).
// Config: OLLAMA_BASE_URL, OLLAMA_API_KEY, OLLAMA_MODEL.
export function createOllamaProvider(): LLMProvider {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "https://ollama.com").replace(/\/$/, "");
  const apiKey = process.env.OLLAMA_API_KEY || "";
  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b";

  return {
    name: "ollama",
    usaLLM: true,
    async complete(messages: LLMMessage[], opts: LLMCompleteOptions = {}): Promise<string> {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 512,
          // Modelos de raciocínio (gpt-oss) gastam tokens no campo `reasoning`;
          // "low" reduz esse overhead e a latência. Ignorado por modelos que não
          // suportam o parâmetro (endpoint OpenAI-compat do Ollama é tolerante).
          reasoning_effort: "low",
          stream: false,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama Cloud respondeu ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    },
  };
}
