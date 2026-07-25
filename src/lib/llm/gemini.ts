import type { LLMCompleteOptions, LLMMessage, LLMProvider } from "@/lib/llm/types";

// Provider Google Gemini (Generative Language API, v1beta:generateContent).
// Config: GEMINI_API_KEY, GEMINI_MODEL, GEMINI_BASE_URL (opcional).
// Modelos Gemini 2.5+/3.x usam "thinking" por padrão: o raciocínio consome
// parte do orçamento de saída ANTES do texto final. Com maxOutputTokens baixo,
// a resposta volta com finishReason=MAX_TOKENS e conteúdo vazio/truncado. Damos
// esta folga ALÉM do orçamento pedido pelo chamador (mais robusto que
// thinkingConfig, que alguns modelos rejeitam com 400).
const THINKING_HEADROOM = 1536;

export function createGeminiProvider(): LLMProvider {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const baseUrl = (
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");

  return {
    name: "gemini",
    usaLLM: true,
    async complete(messages: LLMMessage[], opts: LLMCompleteOptions = {}): Promise<string> {
      // A API do Gemini separa a instrução de sistema (`systemInstruction`) das
      // mensagens de conversa e usa o papel "model" no lugar de "assistant".
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            maxOutputTokens: (opts.maxTokens ?? 512) + THINKING_HEADROOM,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini respondeu ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return (
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? ""
      );
    },
  };
}
