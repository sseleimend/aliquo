/**
 * Desambiguação por atributo técnico (RF-A2) — DETERMINÍSTICA.
 *
 * A pergunta não é inventada pela IA: ela é extraída do próprio texto oficial
 * que separa os candidatos irmãos. Isso importa por três razões:
 *
 *   1. o atributo discriminante É o texto legal — parafraseá-lo introduz erro;
 *   2. a pergunta continua existindo quando a IA falha (RNF-3);
 *   3. cada opção carrega o índice do candidato, então a resposta volta
 *      mecanicamente para um código — sem reinterpretar texto livre.
 *
 * Caso canônico, o mesmo que o PRD cita e que a Fase 1 errava:
 *   8508.11.00  "De potência não superior a 1.500 W e cujo volume do
 *                reservatório não exceda 20 l"
 *   8508.19.00  "Outros"
 * → pergunta sobre potência e capacidade, nunca um chute.
 */

import { limparTravessoes } from "./codigo";

export interface OpcaoPergunta {
  /** Índice do candidato no conjunto recuperado. */
  i: number;
  rotulo: string;
  /** Texto oficial que sustenta a opção (RNF-1). */
  textoOficial: string;
}

export interface PerguntaAtributo {
  texto: string;
  atributo: string;
  opcoes: OpcaoPergunta[];
  /** true quando a pergunta nasceu de um limite numérico do texto oficial. */
  numerica: boolean;
}

interface CandidatoMin {
  codigo: string;
  descricao: string;
  caminho: string;
}

/** Unidades como aparecem no texto oficial, mapeadas para a grandeza. */
const GRANDEZAS: Array<{ re: RegExp; unidade: string; grandeza: string }> = [
  { re: /\b(kw)\b/i, unidade: "kW", grandeza: "potência" },
  { re: /\b(w)\b/i, unidade: "W", grandeza: "potência" },
  { re: /\b(v)\b/i, unidade: "V", grandeza: "tensão" },
  { re: /\b(hz)\b/i, unidade: "Hz", grandeza: "frequência" },
  { re: /\b(kg)\b/i, unidade: "kg", grandeza: "peso" },
  { re: /\b(g)\b/i, unidade: "g", grandeza: "peso" },
  { re: /\b(l|litros?)\b/i, unidade: "l", grandeza: "capacidade" },
  { re: /\b(ml)\b/i, unidade: "ml", grandeza: "capacidade" },
  { re: /\b(mm)\b/i, unidade: "mm", grandeza: "dimensão" },
  { re: /\b(cm)\b/i, unidade: "cm", grandeza: "dimensão" },
  { re: /\b(m)\b/i, unidade: "m", grandeza: "dimensão" },
  { re: /\b(pol|polegadas?)\b/i, unidade: "pol", grandeza: "dimensão" },
];

export interface Limite {
  comparador: "ate" | "acima" | "exato";
  valor: string;
  unidade: string;
  grandeza: string;
}

/**
 * Extrai limites numéricos do texto oficial.
 * Cobre as formas usadas na nomenclatura: "não superior a X", "que não exceda
 * X", "superior a X", "inferior a X", "de X ou mais".
 */
export function extrairLimites(texto: string): Limite[] {
  const t = limparTravessoes(texto);
  const limites: Limite[] = [];

  const padroes: Array<{ re: RegExp; comparador: Limite["comparador"] }> = [
    { re: /n[ãa]o\s+(?:seja\s+)?superior\s+a\s+([\d.,]+)\s*([a-zA-Zç]+)/gi, comparador: "ate" },
    { re: /n[ãa]o\s+exceda\s+(?:a\s+)?([\d.,]+)\s*([a-zA-Zç]+)/gi, comparador: "ate" },
    { re: /(?:igual\s+ou\s+)?inferior\s+a\s+([\d.,]+)\s*([a-zA-Zç]+)/gi, comparador: "ate" },
    { re: /superior\s+a\s+([\d.,]+)\s*([a-zA-Zç]+)/gi, comparador: "acima" },
    { re: /de\s+([\d.,]+)\s*([a-zA-Zç]+)\s+ou\s+mais/gi, comparador: "acima" },
  ];

  for (const { re, comparador } of padroes) {
    for (const m of t.matchAll(re)) {
      const valor = m[1];
      const bruto = m[2] ?? "";
      const g = GRANDEZAS.find((x) => x.re.test(bruto));
      if (!g) continue;
      // "não superior a" já foi capturado por um padrão anterior; evita
      // registrar o mesmo trecho duas vezes como "acima".
      if (comparador === "acima" && /n[ãa]o\s+superior/i.test(t.slice(Math.max(0, m.index! - 12), m.index! + 8))) {
        continue;
      }
      limites.push({ comparador, valor, unidade: g.unidade, grandeza: g.grandeza });
    }
  }

  // Dedupe por grandeza+valor.
  const vistos = new Set<string>();
  return limites.filter((l) => {
    const k = `${l.grandeza}|${l.valor}|${l.comparador}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** "Outros"/"Outras" — a folha residual do Sistema Harmonizado. */
function ehResidual(descricao: string): boolean {
  return /^outr[oa]s?\b/i.test(limparTravessoes(descricao));
}

/**
 * Prefixo comum mais profundo entre os códigos — identifica se os candidatos
 * são realmente irmãos (mesma subposição) ou primos distantes.
 */
export function prefixoComum(codigos: string[]): string {
  if (!codigos.length) return "";
  let p = codigos[0];
  for (const c of codigos.slice(1)) {
    let i = 0;
    while (i < p.length && i < c.length && p[i] === c[i]) i++;
    p = p.slice(0, i);
  }
  return p;
}

/**
 * Monta a pergunta que separa os candidatos.
 * Devolve null quando não há divergência que valha perguntar.
 */
export function montarPergunta(
  candidatos: CandidatoMin[],
  atributosJaInformados: string[] = [],
): PerguntaAtributo | null {
  if (candidatos.length < 2) return null;

  const topo = candidatos.slice(0, 5);
  const comum = prefixoComum(topo.map((c) => c.codigo));

  // Se nem o capítulo bate, o problema não é atributo — é escopo. Perguntar
  // "qual a potência?" quando os candidatos são de capítulos diferentes só
  // confunde; melhor pedir para o usuário escolher a família.
  const mesmaFamilia = comum.length >= 4;

  const jaInformados = new Set(atributosJaInformados.map((a) => a.toLowerCase()));

  if (mesmaFamilia) {
    // --- Caso numérico: um irmão tem limite, outro é "Outros" -------------
    const comLimite = topo
      .map((c, i) => ({ c, i, limites: extrairLimites(c.descricao) }))
      .filter((x) => x.limites.length > 0);

    const residuais = topo
      .map((c, i) => ({ c, i }))
      .filter((x) => ehResidual(x.c.descricao));

    if (comLimite.length > 0) {
      const alvo = comLimite[0];
      const grandezas = [...new Set(alvo.limites.map((l) => l.grandeza))];
      const chave = grandezas.join("+");

      if (!jaInformados.has(chave)) {
        const descricaoLimite = alvo.limites
          .map((l) => `${l.comparador === "ate" ? "até" : "acima de"} ${l.valor} ${l.unidade}`)
          .join(" e ");

        const opcoes: OpcaoPergunta[] = [
          {
            i: alvo.i,
            rotulo: `Sim — ${descricaoLimite}`,
            textoOficial: limparTravessoes(alvo.c.descricao),
          },
        ];

        const alternativa = residuais[0] ?? comLimite[1];
        if (alternativa && alternativa.i !== alvo.i) {
          opcoes.push({
            i: alternativa.i,
            rotulo: `Não — fora desse limite`,
            textoOficial: limparTravessoes(alternativa.c.descricao),
          });
        }

        if (opcoes.length >= 2) {
          const listaGrandezas = grandezas.join(" e ");
          return {
            texto: `Qual a ${listaGrandezas} do produto? Ele fica ${descricaoLimite}?`,
            atributo: chave,
            opcoes,
            numerica: true,
          };
        }
      }
    }
  }

  // --- Caso geral: apresenta os fragmentos oficiais como escolha ----------
  // Sem paráfrase: o texto legal é a opção.
  const vistos = new Set<string>();
  const opcoes: OpcaoPergunta[] = [];
  for (let i = 0; i < topo.length; i++) {
    const frag = limparTravessoes(topo[i].descricao);
    const chave = frag.toLowerCase();
    if (!frag || vistos.has(chave)) continue;
    vistos.add(chave);
    opcoes.push({
      i,
      rotulo: ehResidual(frag) ? `${frag} (nenhuma das anteriores)` : frag,
      textoOficial: topo[i].caminho,
    });
  }

  if (opcoes.length < 2) return null;
  if (jaInformados.has("familia")) return null;

  return {
    texto: mesmaFamilia
      ? "Qual destas descrições oficiais corresponde ao produto?"
      : "Em qual destas famílias o produto se enquadra?",
    atributo: mesmaFamilia ? "variante" : "familia",
    opcoes,
    numerica: false,
  };
}
