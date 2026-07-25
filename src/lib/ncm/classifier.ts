// ─────────────────────────────────────────────────────────────────────────
// Descoberta de NCM assistida (Módulo A — RF02 a RF06).
//
// Fluxo (stateless): o cliente envia a descrição inicial + as respostas às
// perguntas de refino acumuladas. Com um provider de LLM real, TODO o trabalho
// é do modelo, numa única chamada por turno que devolve:
//   - "reformulacao": a descrição reescrita em termos técnicos (RF03);
//   - "proximaPergunta": UMA pergunta de refino, se ainda houver ambiguidade
//     (RF04, teto de 5 perguntas); OU
//   - "candidatos": 4 a 6 códigos NCM prováveis (RF05), com disclaimer.
//
// A base de amostra (NCM_DATASET) NÃO alimenta mais a lista de candidatos: ela
// só é usada como fallback determinístico quando não há chave de LLM (provider
// `mock`) ou se a chamada ao modelo falhar. As alíquotas por NCM continuam vindo
// da base (lib/tax/rates.ts); NCMs fora dela usam alíquotas padrão + aviso.
//
// A confirmação humana de um candidato (RF06) é imposta na UI antes do cálculo.
// ─────────────────────────────────────────────────────────────────────────

import { getLLMProvider } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/types";
import { NCM_DATASET, findByNcm, normalizeNcm, type NcmEntry } from "@/lib/ncm/dataset";
import type {
  Candidato,
  NcmChatRequest,
  NcmChatResponse,
} from "@/lib/ncm/chat-types";

export type { Candidato, NcmChatRequest, NcmChatResponse } from "@/lib/ncm/chat-types";

export const MAX_PERGUNTAS = 5; // RF04
const CONFIANCA_MINIMA = 0.6; // usado apenas no fallback determinístico
const MAX_CANDIDATOS = 6;

export const DISCLAIMER_NCM =
  "Sugestões geradas automaticamente — NÃO são uma classificação fiscal oficial. " +
  "Confirme na fonte oficial (Receita Federal) antes de qualquer decisão.";

// ── Utilidades de texto ────────────────────────────────────────────────────

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Só dígitos do NCM — usado para deduplicar candidatos. */
function digitos(ncm: string): string {
  return (ncm || "").replace(/\D/g, "");
}

// Normaliza a saída do LLM: colapsa espaços/quebras e remove aspas (retas ou
// curvas) que alguns modelos (ex.: gpt-oss) adicionam ao redor do texto.
function limparSaidaLLM(s: string): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "").trim();
}

// ── Parsing tolerante do JSON do LLM ─────────────────────────────────────────

// Faz JSON.parse tolerante a texto/cercas de código ao redor do objeto.
function parseJsonLoose(raw: string): unknown {
  const txt = limparSaidaLLM(raw).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    const ini = txt.search(/[[{]/);
    const fim = Math.max(txt.lastIndexOf("]"), txt.lastIndexOf("}"));
    if (ini < 0 || fim <= ini) return null;
    try {
      return JSON.parse(txt.slice(ini, fim + 1));
    } catch {
      return null;
    }
  }
}

// Converte o array de candidatos do LLM em Candidato[] validados e deduplicados.
function candidatosFromArray(value: unknown): Candidato[] {
  const arr = Array.isArray(value)
    ? value
    : Array.isArray((value as { candidatos?: unknown })?.candidatos)
      ? (value as { candidatos: unknown[] }).candidatos
      : [];

  const out: Candidato[] = [];
  const vistos = new Set<string>();
  for (const item of arr as Array<Record<string, unknown>>) {
    const ncm = normalizeNcm(String(item?.ncm ?? ""));
    const d = digitos(ncm);
    if (d.length !== 8 || vistos.has(d)) continue;
    vistos.add(d);
    const conf = Number(item?.confianca);
    out.push({
      ncm,
      descricao: String(item?.descricao ?? "").trim().slice(0, 200) || "Sugestão de NCM",
      categoria: String(item?.categoria ?? "").trim() || "Sugerido pela IA",
      score: 0,
      confianca: Number.isFinite(conf) ? clamp01(conf) : 0,
      fonte: "ia",
    });
  }
  return out.slice(0, MAX_CANDIDATOS);
}

// ── Descoberta conduzida pela IA (caminho principal) ─────────────────────────

async function descobrirNcmIA(
  provider: LLMProvider,
  descricao: string,
  respostas: string[],
): Promise<NcmChatResponse | null> {
  const perguntasFeitas = respostas.length;
  const atingiuTeto = perguntasFeitas >= MAX_PERGUNTAS;

  const query =
    `Descrição do produto: ${descricao}` +
    (respostas.length ? `\nRespostas de refino já dadas: ${respostas.join(" | ")}` : "");

  const regras = atingiuTeto
    ? `Você já fez ${perguntasFeitas} perguntas (teto atingido): NÃO faça outra pergunta — ` +
      `"proximaPergunta" deve ser null e você DEVE retornar de 4 a 6 candidatos.`
    : `Você já fez ${perguntasFeitas} de ${MAX_PERGUNTAS} perguntas. Se a descrição ainda for ` +
      `ambígua a ponto de misturar posições/capítulos diferentes, faça UMA pergunta curta e ` +
      `objetiva em "proximaPergunta" e deixe "candidatos" como null. Se já der para classificar ` +
      `com confiança, deixe "proximaPergunta" null e retorne de 4 a 6 candidatos.`;

  const sys =
    "Você é um especialista em classificação fiscal NCM/SH do Brasil conduzindo um chat para " +
    "descobrir o NCM de um produto de importação. " +
    regras +
    " Candidatos vão do mais provável ao menos provável; código NCM tem 8 dígitos e a categoria " +
    "deve indicar o capítulo. Responda APENAS com JSON válido, sem texto ao redor, no formato: " +
    '{"reformulacao":"descrição reescrita em termos técnicos, uma frase",' +
    '"proximaPergunta":"pergunta ou null",' +
    '"candidatos":[{"ncm":"0000.00.00","descricao":"...","categoria":"NN — capítulo","confianca":0.0}]}';

  const out = await provider.complete(
    [
      { role: "system", content: sys },
      { role: "user", content: query },
    ],
    { temperature: 0.2, maxTokens: 900, json: true },
  );

  const obj = parseJsonLoose(out);
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  const reformulacao = String(o.reformulacao ?? "").trim() || descricao;
  const candidatos = candidatosFromArray(o.candidatos);
  const proximaPergunta = String(o.proximaPergunta ?? "").trim();
  const temPergunta = proximaPergunta.length > 0 && proximaPergunta.toLowerCase() !== "null";

  // Ainda refinando: sem teto, sem candidatos e com uma pergunta a fazer.
  if (!atingiuTeto && candidatos.length === 0 && temPergunta) {
    return {
      reformulacao,
      perguntasFeitas,
      proximaPergunta,
      atingiuTeto: false,
      confianca: 0.4,
      candidatos: null,
      disclaimer: DISCLAIMER_NCM,
    };
  }

  // Nada utilizável do modelo → deixa o chamador cair no fallback.
  if (candidatos.length === 0) return null;

  const confianca = candidatos.reduce((m, c) => Math.max(m, c.confianca), 0) || 0.7;
  return {
    reformulacao,
    perguntasFeitas,
    proximaPergunta: null,
    atingiuTeto,
    confianca,
    candidatos,
    disclaimer: DISCLAIMER_NCM,
  };
}

// ── Fallback determinístico sobre a base de amostra (sem chave / falha da IA) ──

interface Scored {
  entry: NcmEntry;
  score: number;
}

function scoreEntry(entry: NcmEntry, queryNorm: string): number {
  let score = 0;
  for (const kw of entry.keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (queryNorm.includes(k)) {
      score += k.includes(" ") ? 3 : k.length >= 4 ? 2 : 1;
    }
  }
  return score;
}

function rankear(queryNorm: string): Scored[] {
  return NCM_DATASET.map((entry) => ({ entry, score: scoreEntry(entry, queryNorm) })).sort(
    (a, b) => b.score - a.score,
  );
}

function calcConfianca(top: number, second: number): number {
  if (top <= 0) return 0;
  const forca = Math.min(1, top / 6);
  const separacao = Math.min(1, (top - second) / 4);
  return Math.round(clamp01(0.5 * forca + 0.5 * (0.5 + 0.5 * separacao)) * 100) / 100;
}

function montarCandidatos(ranked: Scored[]): { candidatos: Candidato[]; semMatch: boolean } {
  const comMatch = ranked.filter((r) => r.score > 0);
  const semMatch = comMatch.length === 0;
  const MIN = 2;
  const MAX = 3;
  const base = (semMatch ? [] : comMatch).slice(0, MAX);
  for (const r of ranked) {
    if (base.length >= MIN) break;
    if (!base.includes(r)) base.push(r);
  }
  const soma = base.reduce((s, r) => s + r.score, 0) || 1;
  const candidatos: Candidato[] = base.map((r) => ({
    ncm: r.entry.ncm,
    descricao: r.entry.descricao,
    categoria: r.entry.categoria,
    score: r.score,
    confianca: Math.round((r.score / soma) * 100) / 100,
    fonte: "base",
  }));
  return { candidatos, semMatch };
}

function reformularRegra(query: string, ranked: Scored[]): string {
  const top = ranked[0];
  if (!top || top.score === 0) {
    return `Descrição analisada: "${query}". Nenhum termo técnico forte identificado — refine com material e função.`;
  }
  const termos = top.entry.keywords
    .filter((kw) => query.includes(normalize(kw)) || normalize(query).includes(normalize(kw)))
    .slice(0, 5);
  return `Termos técnicos identificados: ${termos.join(", ")} — categoria provável: ${top.entry.categoria}.`;
}

const PERGUNTAS_GENERICAS = [
  "Qual é o material predominante do produto (ex.: plástico, metal, algodão, couro)?",
  "Qual a função ou uso principal do produto?",
  "É um produto acabado, uma peça/componente ou um acessório?",
  "O produto possui componentes eletrônicos ou é alimentado por energia?",
  "Há alguma característica técnica relevante (dimensão, capacidade, voltagem, composição)?",
];

function short(desc: string): string {
  return desc.length > 60 ? `${desc.slice(0, 57)}…` : desc;
}

function perguntaRegra(ranked: Scored[], perguntasFeitas: number): string {
  const [top, second] = ranked;
  if (
    perguntasFeitas === 0 &&
    top &&
    second &&
    top.score > 0 &&
    second.score > 0 &&
    top.entry.categoria !== second.entry.categoria
  ) {
    return `O produto se aproxima mais de "${short(top.entry.descricao)}" ou de "${short(
      second.entry.descricao,
    )}"? Descreva o que os diferencia.`;
  }
  return PERGUNTAS_GENERICAS[Math.min(perguntasFeitas, PERGUNTAS_GENERICAS.length - 1)];
}

function descobrirNcmRegras(descricao: string, respostas: string[]): NcmChatResponse {
  const perguntasFeitas = respostas.length;
  const queryBruta = [descricao, ...respostas].join(". ");
  const reformulacao = reformularRegra(queryBruta, rankear(normalize(queryBruta)));
  const rankedFinal = rankear(normalize(`${queryBruta} ${reformulacao}`));

  const topScore = rankedFinal[0]?.score ?? 0;
  const confianca = calcConfianca(topScore, rankedFinal[1]?.score ?? 0);
  const atingiuTeto = perguntasFeitas >= MAX_PERGUNTAS;
  const confiante = confianca >= CONFIANCA_MINIMA && topScore > 0;

  if (confiante || atingiuTeto) {
    const { candidatos, semMatch } = montarCandidatos(rankedFinal);
    return {
      reformulacao,
      perguntasFeitas,
      proximaPergunta: null,
      atingiuTeto: atingiuTeto && !confiante,
      confianca,
      candidatos,
      disclaimer: DISCLAIMER_NCM,
      aviso: semMatch
        ? "Nenhuma correspondência forte na base de amostra — os candidatos abaixo são palpites fracos. Considere informar o NCM manualmente."
        : undefined,
    };
  }

  return {
    reformulacao,
    perguntasFeitas,
    proximaPergunta: perguntaRegra(rankedFinal, perguntasFeitas),
    atingiuTeto: false,
    confianca,
    candidatos: null,
    disclaimer: DISCLAIMER_NCM,
  };
}

// ── Orquestração principal ───────────────────────────────────────────────────

export async function descobrirNcm(req: NcmChatRequest): Promise<NcmChatResponse> {
  const provider = getLLMProvider();
  const descricao = (req.descricao || "").trim();
  const respostas = (req.respostas || []).map((r) => (r || "").trim()).filter(Boolean);

  if (provider.usaLLM) {
    try {
      const ia = await descobrirNcmIA(provider, descricao, respostas);
      if (ia) return ia;
    } catch {
      /* IA indisponível — cai para a base de amostra */
    }
  }

  return descobrirNcmRegras(descricao, respostas);
}

// Consulta direta por código (RF01). Retorna a entrada da base, se existir.
export function buscarPorCodigo(ncm: string): NcmEntry | null {
  return findByNcm(ncm) ?? null;
}
