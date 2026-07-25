// ─────────────────────────────────────────────────────────────────────────
// Descoberta de NCM assistida (Módulo A — RF02 a RF06).
//
// Fluxo (stateless): o cliente envia a descrição inicial + as respostas às
// perguntas de refino acumuladas. A cada turno:
//   1. Reformula a descrição em termos técnicos (RF03).
//   2. Rankeia candidatos por keyword scoring sobre a base de amostra.
//   3. Se a confiança for suficiente OU atingir o teto de 5 perguntas (RF04),
//      devolve 2–3 candidatos (RF05) com disclaimer.
//   4. Senão, devolve a próxima pergunta de refino.
//
// A confirmação humana de um candidato (RF06) é imposta na UI antes do cálculo.
// ─────────────────────────────────────────────────────────────────────────

import { getLLMProvider } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/types";
import { NCM_DATASET, findByNcm, type NcmEntry } from "@/lib/ncm/dataset";
import type {
  Candidato,
  NcmChatRequest,
  NcmChatResponse,
} from "@/lib/ncm/chat-types";

export type { Candidato, NcmChatRequest, NcmChatResponse } from "@/lib/ncm/chat-types";

export const MAX_PERGUNTAS = 5; // RF04
const CONFIANCA_MINIMA = 0.6;

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

// Normaliza a saída do LLM: colapsa espaços/quebras e remove aspas (retas ou
// curvas) que alguns modelos (ex.: gpt-oss) adicionam ao redor do texto.
function limparSaidaLLM(s: string): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "").trim();
}

// ── Scoring ────────────────────────────────────────────────────────────────

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
  // 2 a 3 candidatos (RF05). Começa pelos que casaram e, se forem menos de 2,
  // completa com os próximos melhores ranqueados (alternativas para comparar).
  const MIN = 2;
  const MAX = 3;
  const base = (semMatch ? [] : comMatch).slice(0, MAX);
  for (const r of ranked) {
    if (base.length >= MIN) break;
    if (!base.includes(r)) base.push(r);
  }
  const soma = base.reduce((s, r) => s + r.score, 0) || 1;
  const candidatos = base.map((r) => ({
    ncm: r.entry.ncm,
    descricao: r.entry.descricao,
    categoria: r.entry.categoria,
    score: r.score,
    confianca: Math.round((r.score / soma) * 100) / 100,
  }));
  return { candidatos, semMatch };
}

// ── Reformulação (RF03) ──────────────────────────────────────────────────────

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

async function reformular(
  provider: LLMProvider,
  query: string,
  ranked: Scored[],
): Promise<string> {
  if (!provider.usaLLM) return reformularRegra(query, ranked);
  try {
    const out = await provider.complete(
      [
        {
          role: "system",
          content:
            "Você é um especialista em classificação fiscal (NCM/comércio exterior brasileiro). " +
            "Reescreva a descrição do produto do usuário em termos técnicos objetivos, úteis para " +
            "buscar o NCM correto. Responda em uma única frase, sem preâmbulo.",
        },
        { role: "user", content: query },
      ],
      // Folga de tokens: gpt-oss consome parte do orçamento no raciocínio.
      { temperature: 0.2, maxTokens: 500 },
    );
    return limparSaidaLLM(out) || reformularRegra(query, ranked);
  } catch {
    return reformularRegra(query, ranked);
  }
}

// ── Perguntas de refino (RF04) ───────────────────────────────────────────────

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

async function gerarPergunta(
  provider: LLMProvider,
  query: string,
  ranked: Scored[],
  perguntasFeitas: number,
): Promise<string> {
  if (!provider.usaLLM) return perguntaRegra(ranked, perguntasFeitas);
  try {
    const candidatosTxt = ranked
      .slice(0, 3)
      .map((r) => `${r.entry.ncm} — ${r.entry.descricao}`)
      .join("\n");
    const out = await provider.complete(
      [
        {
          role: "system",
          content:
            "Você conduz um chat para classificar um produto por NCM. Faça UMA pergunta curta e " +
            "objetiva que melhor reduza a ambiguidade entre os candidatos. Responda só com a pergunta.",
        },
        {
          role: "user",
          content: `Descrição acumulada: ${query}\n\nCandidatos atuais:\n${candidatosTxt}`,
        },
      ],
      { temperature: 0.3, maxTokens: 400 },
    );
    return limparSaidaLLM(out) || perguntaRegra(ranked, perguntasFeitas);
  } catch {
    return perguntaRegra(ranked, perguntasFeitas);
  }
}

// ── Orquestração principal ───────────────────────────────────────────────────

export async function descobrirNcm(req: NcmChatRequest): Promise<NcmChatResponse> {
  const provider = getLLMProvider();
  const descricao = (req.descricao || "").trim();
  const respostas = (req.respostas || []).map((r) => (r || "").trim()).filter(Boolean);
  const perguntasFeitas = respostas.length;

  const queryBruta = [descricao, ...respostas].join(". ");
  const queryNormBase = normalize(queryBruta);
  const ranked = rankear(queryNormBase);

  const reformulacao = await reformular(provider, queryBruta, ranked);
  // Reforça a busca com a reformulação (pode trazer sinônimos técnicos).
  const rankedFinal = rankear(normalize(`${queryBruta} ${reformulacao}`));

  const topScore = rankedFinal[0]?.score ?? 0;
  const secondScore = rankedFinal[1]?.score ?? 0;
  const confianca = calcConfianca(topScore, secondScore);

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

  const proximaPergunta = await gerarPergunta(provider, queryBruta, rankedFinal, perguntasFeitas);
  return {
    reformulacao,
    perguntasFeitas,
    proximaPergunta,
    atingiuTeto: false,
    confianca,
    candidatos: null,
    disclaimer: DISCLAIMER_NCM,
  };
}

// Consulta direta por código (RF01). Retorna a entrada da base, se existir.
export function buscarPorCodigo(ncm: string): NcmEntry | null {
  return findByNcm(ncm) ?? null;
}
