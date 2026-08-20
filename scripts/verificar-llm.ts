/**
 * Confere que o provider de IA configurado responde de verdade.
 *
 * Complemento do `verificar-banco.ts`: o classificador engole falha de provider
 * e cai na recuperação pela base oficial — degradação correta, porém silenciosa.
 * Em produção, o sintoma de uma chave errada é "a IA ficou burra", não um erro.
 * Este script transforma isso em um sim ou não.
 *
 * Uso: npx tsx scripts/verificar-llm.ts
 */

import "./lib/env";
import { getLLMProvider } from "../src/lib/llm";

function mascarar(valor: string): string {
  if (!valor) return "(vazia)";
  return `${valor.slice(0, 3)}…${valor.slice(-2)} (${valor.length} caracteres)`;
}

async function main() {
  const provider = getLLMProvider();
  console.log(`Provider: ${provider.name} (usaLLM=${provider.usaLLM})`);
  console.log(`Modelo  : ${process.env.OLLAMA_MODEL || "(padrão do provider)"}`);
  console.log(`Endpoint: ${process.env.OLLAMA_BASE_URL || "(padrão do provider)"}`);
  console.log(`Chave   : ${mascarar(process.env.OLLAMA_API_KEY || "")}\n`);

  if (!provider.usaLLM) {
    console.log("Provider sem rede (mock/scripted) — nada a conferir.");
    return;
  }

  // Prompt curto de propósito: o que se testa é a credencial e o caminho de
  // rede, não a qualidade da classificação (isso é o `npm run ncm:eval`).
  //
  // O orçamento de saída, porém, NÃO pode ser curto: gpt-oss é modelo de
  // raciocínio e gasta tokens no campo `reasoning` antes de escrever o
  // `content`. Com 32 tokens a resposta volta 200 OK e vazia — parece chave
  // morta e não é.
  const r = await provider.complete(
    [
      { role: "system", content: "Responda em uma palavra." },
      { role: "user", content: "Qual o nome do aparelho que aspira pó sozinho pela casa?" },
    ],
    { maxTokens: 256, temperature: 0 },
  );

  console.log(`Resposta : ${r.texto.slice(0, 120) || "(vazia)"}`);
  console.log(`Latência : ${r.latencyMs} ms`);
  console.log(`Tokens   : entrada ${r.inputTokens ?? "?"} / saída ${r.outputTokens ?? "?"}`);

  if (!r.texto.trim()) throw new Error("Provider respondeu vazio.");
  console.log("\nProvider de IA respondendo.");
}

main().catch((e) => {
  console.error(`\nFALHA: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
