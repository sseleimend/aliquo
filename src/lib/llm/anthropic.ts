import type {
  LLMCompleteOptions,
  LLMMessage,
  LLMProvider,
  LLMResposta,
} from "@/lib/llm/types";

// Provider Anthropic (Messages API) — pronto para troca futura.
// Config: ANTHROPIC_API_KEY, ANTHROPIC_MODEL.
export function createAnthropicProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  return {
    name: "anthropic",
    usaLLM: true,
    async complete(messages: LLMMessage[], opts: LLMCompleteOptions = {}): Promise<LLMResposta> {
      const inicio = Date.now();
      // A Messages API separa `system` das mensagens de conversa.
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const convo = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.2,
          ...(system ? { system } : {}),
          messages: convo,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic respondeu ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        content?: { text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        texto: data.content?.map((c) => c.text ?? "").join("").trim() ?? "",
        provider: "anthropic",
        model,
        latencyMs: Date.now() - inicio,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      };
    },
  };
}
