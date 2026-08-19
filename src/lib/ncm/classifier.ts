/**
 * Descoberta de NCM ancorada na base oficial (RF-A1, RF-A2, RF-A3).
 *
 * Pipeline em três estágios, desenhado para que alucinar um código seja
 * ESTRUTURALMENTE IMPOSSÍVEL — não apenas improvável:
 *
 *   1. EXPANSÃO   — a IA traduz a descrição coloquial para o vocabulário da
 *                   nomenclatura. O prompt proíbe códigos, e qualquer coisa
 *                   com cara de NCM é removida da saída antes do uso.
 *   2. RECUPERAÇÃO— BM25/FTS5 sobre a base oficial devolve candidatos REAIS.
 *   3. RANQUEAMENTO— a IA vê a lista numerada e responde com ÍNDICES, nunca
 *                   com códigos. Índice fora da faixa é descartado.
 *
 * Na Fase 1 o modelo escrevia o código livremente e produziu "8509.40.00 —
 * aspiradores de pó não elétricos", que é uma posição de liquidificadores com
 * uma descrição inventada. Aqui isso não tem por onde acontecer: o modelo
 * jamais emite um código.
 */

import { getLLMProvider } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/types";
import { montarPergunta, type PerguntaAtributo } from "./desambiguacao";
import { recuperarCandidatos, type CandidatoNcm } from "./retrieval";

export const MAX_PERGUNTAS = 5;
export const MAX_CANDIDATOS = 6;

export const DISCLAIMER_NCM =
  "Sugestões geradas automaticamente a partir da base oficial — NÃO são uma " +
  "classificação fiscal oficial. Confirme antes de qualquer decisão.";

export interface RespostaAtributo {
  atributo: string;
  valor: string;
  /** Índice escolhido, quando a resposta veio de uma opção. */
  indice?: number;
}

export interface CandidatoSugerido {
  ncm: string; // "8508.11.00"
  codigo: string; // "85081100"
  descricao: string; // texto oficial da folha
  caminho: string; // linhagem oficial completa (RNF-1)
  confianca: number;
  fonte: "base";
  porque?: string;
}

export interface NcmChatRequest {
  descricao: string;
  respostas?: RespostaAtributo[];
}

export interface NcmChatResponse {
  reformulacao: string | null;
  proximaPergunta: PerguntaAtributo | null;
  candidatos: CandidatoSugerido[] | null;
  disclaimer: string;
  avisos: string[];
  /** Diagnóstico: como o resultado foi obtido. */
  meta: {
    usouIA: boolean;
    indiceDegradado: boolean;
    recuperados: number;
    perguntasFeitas: number;
    custo?: {
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Parsing tolerante
// ---------------------------------------------------------------------------

/** Remove qualquer coisa parecida com código NCM de um texto. */
export function removerCodigos(texto: string): string {
  return (texto || "")
    .replace(/\b\d{4}\.?\d{2}\.?\d{2}\b/g, " ")
    .replace(/\b\d{6,8}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonTolerante<T>(bruto: string): T | null {
  if (!bruto) return null;
  const limpo = bruto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[“”]/g, '"')
    .trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    const ini = limpo.search(/[[{]/);
    const fimObj = limpo.lastIndexOf("}");
    const fimArr = limpo.lastIndexOf("]");
    const fim = Math.max(fimObj, fimArr);
    if (ini >= 0 && fim > ini) {
      try {
        return JSON.parse(limpo.slice(ini, fim + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Estágio 1 — expansão de consulta
// ---------------------------------------------------------------------------

interface SaidaExpansao {
  termosBusca?: string[];
  termosEn?: string[];
  reformulacao?: string;
  capitulos?: Array<string | number>;
}

const PROMPT_EXPANSAO =
  "Você ajuda a preparar uma BUSCA na Nomenclatura Comum do Mercosul (NCM). " +
  "Você NÃO conhece códigos NCM e NUNCA deve escrever números de código — " +
  "sua única tarefa é traduzir a descrição do usuário para o vocabulário " +
  "técnico usado na nomenclatura oficial brasileira. " +
  "Responda APENAS com JSON válido no formato: " +
  '{"reformulacao":"descrição técnica em uma frase",' +
  '"termosBusca":["termos em português, no singular, como apareceriam na nomenclatura"],' +
  '"termosEn":["termos equivalentes em inglês"],' +
  '"capitulos":["dois dígitos do capítulo provável"]}';

async function expandirConsulta(
  provider: LLMProvider,
  descricao: string,
  respostas: RespostaAtributo[],
): Promise<{ saida: SaidaExpansao; custo?: NcmChatResponse["meta"]["custo"] } | null> {
  const contexto = respostas.length
    ? `\nAtributos já informados: ${respostas.map((r) => `${r.atributo}=${r.valor}`).join("; ")}`
    : "";

  const r = await provider.complete(
    [
      { role: "system", content: PROMPT_EXPANSAO },
      { role: "user", content: `Produto: ${descricao}${contexto}` },
    ],
    { temperature: 0.1, maxTokens: 400, json: true },
  );

  const saida = parseJsonTolerante<SaidaExpansao>(r.texto);
  if (!saida) return null;

  // Cinto e suspensório: mesmo proibido no prompt, filtramos códigos.
  return {
    saida: {
      reformulacao: saida.reformulacao ? removerCodigos(String(saida.reformulacao)) : undefined,
      termosBusca: (saida.termosBusca ?? []).map((t) => removerCodigos(String(t))).filter(Boolean),
      termosEn: (saida.termosEn ?? []).map((t) => removerCodigos(String(t))).filter(Boolean),
      capitulos: (saida.capitulos ?? [])
        .map((c) => String(c).replace(/\D/g, "").slice(0, 2))
        .filter((c) => c.length === 2),
    },
    custo: {
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      latencyMs: r.latencyMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Estágio 3 — ranqueamento por índice
// ---------------------------------------------------------------------------

interface SaidaRanking {
  escolhas?: Array<{ i?: number; confianca?: number; porque?: string }>;
}

const PROMPT_RANKING =
  "Você é especialista em classificação fiscal NCM/SH do Brasil. " +
  "Recebe uma lista NUMERADA de classificações oficiais candidatas e deve " +
  "escolher as que melhor descrevem o produto. " +
  "Você só pode responder com os ÍNDICES da lista — nunca escreva um código NCM, " +
  "nunca invente uma opção que não esteja na lista. " +
  "Ordene da mais provável para a menos provável, no máximo 6. " +
  "Se a lista não contiver nada adequado, devolva escolhas vazias. " +
  "Responda APENAS com JSON: " +
  '{"escolhas":[{"i":0,"confianca":0.0,"porque":"justificativa curta"}]}';

async function ranquear(
  provider: LLMProvider,
  descricao: string,
  respostas: RespostaAtributo[],
  candidatos: CandidatoNcm[],
): Promise<{ escolhas: Array<{ i: number; confianca: number; porque?: string }>; custo?: NcmChatResponse["meta"]["custo"] } | null> {
  const lista = candidatos
    .map((c, i) => `[${i}] ${c.codigoFmt} — ${c.caminho}`)
    .join("\n");

  const contexto = respostas.length
    ? `\nAtributos informados pelo usuário: ${respostas.map((r) => `${r.atributo}=${r.valor}`).join("; ")}`
    : "";

  const r = await provider.complete(
    [
      { role: "system", content: PROMPT_RANKING },
      {
        role: "user",
        content: `Produto: ${descricao}${contexto}\n\nCandidatos oficiais:\n${lista}`,
      },
    ],
    { temperature: 0.1, maxTokens: 700, json: true },
  );

  const saida = parseJsonTolerante<SaidaRanking>(r.texto);
  if (!saida?.escolhas) return null;

  // VALIDAÇÃO DURA: índice precisa ser inteiro dentro da faixa recuperada.
  // É aqui que uma alucinação morre.
  const vistos = new Set<number>();
  const escolhas = saida.escolhas
    .map((e) => ({
      i: Number(e?.i),
      confianca: Number(e?.confianca),
      porque: typeof e?.porque === "string" ? e.porque.slice(0, 240) : undefined,
    }))
    .filter((e) => Number.isInteger(e.i) && e.i >= 0 && e.i < candidatos.length)
    .filter((e) => (vistos.has(e.i) ? false : (vistos.add(e.i), true)))
    .map((e) => ({
      ...e,
      confianca: Number.isFinite(e.confianca) ? Math.min(1, Math.max(0, e.confianca)) : 0.5,
    }))
    .slice(0, MAX_CANDIDATOS);

  return {
    escolhas,
    custo: {
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      latencyMs: r.latencyMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

function paraSugerido(c: CandidatoNcm, confianca: number, porque?: string): CandidatoSugerido {
  return {
    ncm: c.codigoFmt,
    codigo: c.codigo,
    descricao: c.descricao,
    caminho: c.caminho,
    confianca: Math.round(confianca * 100) / 100,
    fonte: "base",
    porque,
  };
}

/** Confiança derivada do próprio BM25, para quando não há IA. */
function confiancaPorScore(candidatos: CandidatoNcm[], i: number): number {
  const top = candidatos[0]?.score ?? 0;
  if (top <= 0) return 0.3;
  const rel = (candidatos[i]?.score ?? 0) / top;
  return Math.min(0.9, Math.max(0.2, rel * 0.8));
}

export async function descobrirNcm(
  req: NcmChatRequest,
  providerInjetado?: LLMProvider,
): Promise<NcmChatResponse> {
  const provider = providerInjetado ?? getLLMProvider();
  const descricao = (req.descricao || "").trim();
  const respostas = (req.respostas ?? []).filter((r) => r && r.valor);
  const avisos: string[] = [];

  let reformulacao: string | null = null;
  let termosExtras: string[] = [];
  let capitulos: string[] = [];
  let usouIA = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let latencyMs = 0;
  let providerUsado = provider.name;
  let modelUsado = "-";

  // --- Estágio 1 ---------------------------------------------------------
  if (provider.usaLLM) {
    try {
      const exp = await expandirConsulta(provider, descricao, respostas);
      if (exp) {
        usouIA = true;
        reformulacao = exp.saida.reformulacao ?? null;
        termosExtras = [...(exp.saida.termosBusca ?? []), ...(exp.saida.termosEn ?? [])];
        capitulos = (exp.saida.capitulos ?? []) as string[];
        inputTokens += exp.custo?.inputTokens ?? 0;
        outputTokens += exp.custo?.outputTokens ?? 0;
        latencyMs += exp.custo?.latencyMs ?? 0;
        providerUsado = exp.custo?.provider ?? providerUsado;
        modelUsado = exp.custo?.model ?? modelUsado;
      }
    } catch {
      // Degradação explícita, nunca silenciosa (RNF-3): a busca segue só com
      // os termos do usuário e o aviso aparece na tela.
      avisos.push(
        "A expansão por IA falhou; a busca usou apenas os termos que você digitou. " +
          "Os candidatos continuam vindo da base oficial.",
      );
    }
  }

  // --- Estágio 2 ---------------------------------------------------------
  const textoBusca = [descricao, ...respostas.map((r) => r.valor)].join(" ");
  const { candidatos, indiceDegradado } = await recuperarCandidatos({
    descricao: textoBusca,
    termosExtras,
    capitulos,
    limite: 30,
  });

  if (indiceDegradado) {
    avisos.push(
      "O índice de busca não está disponível; usando busca simplificada. " +
        "Rode `npm run ncm:index` para restaurar a qualidade das sugestões.",
    );
  }

  if (candidatos.length === 0) {
    return {
      reformulacao,
      proximaPergunta: null,
      candidatos: [],
      disclaimer: DISCLAIMER_NCM,
      avisos: [
        ...avisos,
        "Nenhuma classificação oficial correspondeu à descrição. Tente detalhar " +
          "material, função e características técnicas — ou informe a NCM diretamente.",
      ],
      meta: { usouIA, indiceDegradado, recuperados: 0, perguntasFeitas: respostas.length },
    };
  }

  // --- Estágio 3 ---------------------------------------------------------
  let ordenados: CandidatoSugerido[];

  let escolhas: Array<{ i: number; confianca: number; porque?: string }> | null = null;
  if (provider.usaLLM) {
    try {
      const r = await ranquear(provider, descricao, respostas, candidatos);
      if (r && r.escolhas.length) {
        escolhas = r.escolhas;
        usouIA = true;
        inputTokens += r.custo?.inputTokens ?? 0;
        outputTokens += r.custo?.outputTokens ?? 0;
        latencyMs += r.custo?.latencyMs ?? 0;
        providerUsado = r.custo?.provider ?? providerUsado;
        modelUsado = r.custo?.model ?? modelUsado;
      }
    } catch {
      avisos.push(
        "A ordenação por IA falhou; os candidatos estão na ordem da busca na base oficial.",
      );
    }
  }

  if (escolhas) {
    ordenados = escolhas.map((e) => paraSugerido(candidatos[e.i], e.confianca, e.porque));
  } else {
    ordenados = candidatos
      .slice(0, MAX_CANDIDATOS)
      .map((c, i) => paraSugerido(c, confiancaPorScore(candidatos, i)));
  }

  // --- Desambiguação (RF-A2) ---------------------------------------------
  // Se os melhores candidatos ainda divergem por atributo técnico, pergunta.
  // Nunca chuta — foi exatamente esse chute que errou o robô aspirador.
  const perguntasFeitas = respostas.length;
  let proximaPergunta: PerguntaAtributo | null = null;

  if (perguntasFeitas < MAX_PERGUNTAS && ordenados.length > 1) {
    const topo = ordenados.slice(0, 5).map((c) => ({
      codigo: c.codigo,
      descricao: c.descricao,
      caminho: c.caminho,
    }));
    const separacao = ordenados[0].confianca - (ordenados[1]?.confianca ?? 0);
    // Confiança já bem separada => não incomoda o usuário com pergunta.
    if (separacao < 0.25) {
      proximaPergunta = montarPergunta(
        topo,
        respostas.map((r) => r.atributo),
      );
    }
  }

  return {
    reformulacao,
    proximaPergunta,
    candidatos: ordenados.slice(0, MAX_CANDIDATOS),
    disclaimer: DISCLAIMER_NCM,
    avisos,
    meta: {
      usouIA,
      indiceDegradado,
      recuperados: candidatos.length,
      perguntasFeitas,
      custo: usouIA
        ? { provider: providerUsado, model: modelUsado, inputTokens, outputTokens, latencyMs }
        : undefined,
    },
  };
}
