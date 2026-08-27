/**
 * Recuperação de candidatos de NCM na base oficial (RF-A1).
 *
 * Estratégia: BM25 sobre FTS5, em DOIS ESTÁGIOS, espelhando como um
 * despachante classifica de verdade:
 *
 *   1. "em que POSIÇÃO isso cai?"  -> recall temático, texto rico
 *   2. "qual ITEM dentro dela?"    -> precisão, atributos técnicos
 *
 * O segundo estágio é indispensável porque uma folha costuma ser literalmente
 * "-- Outros": ela não tem texto próprio suficiente para ser recuperada
 * sozinha, mas é alcançável descendo a partir da posição vencedora.
 *
 * Nada aqui inventa código: só se devolve o que existe em NcmNomenclatura.
 */

import { prisma } from "@/lib/db";
import { apenasDigitos, formatarNcm, normalizarTexto } from "./codigo";

export interface CandidatoNcm {
  codigo: string; // 8 dígitos, só números
  codigoFmt: string; // "8508.11.00"
  descricao: string; // texto oficial da folha (com travessões)
  caminho: string; // linhagem oficial completa
  score: number; // maior = melhor
  viaPosicao: string | null; // posição pela qual foi alcançado
}

export interface ResultadoRecuperacao {
  candidatos: CandidatoNcm[];
  posicoes: Array<{ codigo: string; descricao: string; score: number }>;
  indiceDegradado: boolean;
}

/** Palavras que só geram ruído no BM25. */
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "ou", "em", "no", "na",
  "nos", "nas", "um", "uma", "uns", "umas", "para", "por", "com", "sem", "que", "ao",
  "aos", "as", "ser", "sao", "eh", "the", "of", "for", "and", "pra", "pro", "meu",
  "minha", "seu", "sua", "esse", "essa", "este", "esta", "isso", "tipo", "quero",
  "preciso", "produto", "item", "novo", "nova",
]);

/**
 * Monta a expressão MATCH do FTS5 com segurança.
 *
 * FTS5 tem sintaxe própria (AND/OR/NOT/NEAR, aspas, `*`, `^`, `:`) — jogar
 * texto do usuário direto ali quebra a consulta e é injetável. Como
 * `normalizarTexto` já reduz tudo a [a-z0-9 ], sobra apenas tokenizar e
 * envolver cada termo em aspas duplas.
 */
export function montarExpressaoMatch(termos: string[]): string {
  const tokens = termos
    .flatMap((t) => normalizarTexto(t).split(" "))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  const unicos = [...new Set(tokens)].slice(0, 24);
  if (unicos.length === 0) return "";

  // Prefixo (`*`) a partir de 4 caracteres. O FTS5 não faz stemming, então sem
  // isso "motor" jamais casa com "Motores" e "aspirador" não casa com
  // "Aspiradores" — o que, em português, quebra a recuperação inteira.
  // Abaixo de 4 caracteres o prefixo abre demais e vira ruído.
  return unicos.map((t) => (t.length >= 4 ? `"${t}"*` : `"${t}"`)).join(" OR ");
}

/**
 * Verifica se o índice existe e está populado.
 * Se não estiver, o chamador degrada para LIKE em vez de quebrar (RNF-3).
 */
export async function indiceDisponivel(): Promise<boolean> {
  try {
    const r = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT count(*) AS n FROM "NcmFts"`,
    );
    return Number(r[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Busca degradada, sem FTS: lenta, porém correta. */
async function recuperarPorLike(descricao: string, limite: number): Promise<CandidatoNcm[]> {
  const termos = normalizarTexto(descricao)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
    .slice(0, 4);
  if (!termos.length) return [];

  const linhas = await prisma.ncmNomenclatura.findMany({
    where: { nivel: "item", OR: termos.map((t) => ({ caminho: { contains: t } })) },
    take: limite,
  });
  return linhas.map((l) => ({
    codigo: l.codigo,
    codigoFmt: l.codigoFmt,
    descricao: l.descricao,
    caminho: l.caminho,
    score: 1,
    viaPosicao: null,
  }));
}

export interface OpcoesRecuperacao {
  descricao: string;
  /** Termos vindos da expansão pela IA — nunca códigos. */
  termosExtras?: string[];
  /** Capítulos prováveis (2 dígitos) para dar boost. */
  capitulos?: string[];
  limite?: number;
  maxPosicoes?: number;
}

export async function recuperarCandidatos(
  opts: OpcoesRecuperacao,
): Promise<ResultadoRecuperacao> {
  const limite = opts.limite ?? 30;
  const maxPosicoes = opts.maxPosicoes ?? 6;

  if (!(await indiceDisponivel())) {
    return {
      candidatos: await recuperarPorLike(opts.descricao, limite),
      posicoes: [],
      indiceDegradado: true,
    };
  }

  const match = montarExpressaoMatch([opts.descricao, ...(opts.termosExtras ?? [])]);
  if (!match) return { candidatos: [], posicoes: [], indiceDegradado: false };

  // --- Estágio 1: posições -------------------------------------------------
  // Pesos por coluna: (codigo, nivel, descricao, caminho, sinonimos).
  // No bm25 do SQLite, MAIS NEGATIVO = melhor.
  //
  // Buscamos em posição E subposição porque nem toda posição existe como linha
  // de 4 dígitos: quando ela tem uma subposição única, a publicação traz só
  // "3303.00" (6 dígitos) e nenhuma "33.03". Agrupar pelo prefixo de 4 dígitos
  // cobre as duas formas — sem isso, perfume/bicicleta/brinquedo somem do
  // primeiro estágio.
  const agrupadoresBrutos = await prisma.$queryRawUnsafe<
    Array<{ codigo: string; nivel: string; descricao: string; rank: number }>
  >(
    `SELECT codigo, nivel, descricao, bm25("NcmFts", 0, 0, 10.0, 3.0, 25.0) AS rank
     FROM "NcmFts"
     WHERE "NcmFts" MATCH ? AND nivel IN ('posicao', 'subposicao')
     ORDER BY rank
     LIMIT ?`,
    match,
    maxPosicoes * 10,
  );

  // Colapsa para o prefixo de 4 dígitos, guardando o melhor score de cada um.
  //
  // Subposições são fragmentos curtos ("- Com motor elétrico incorporado:") e o
  // BM25 premia densidade de termo, então elas atropelam a posição real se
  // pontuadas de igual para igual. O peso menor devolve o primeiro estágio ao
  // nível em que ele deve decidir: a posição.
  const PESO_NIVEL: Record<string, number> = { posicao: 1, subposicao: 0.75 };

  const melhorPorPrefixo = new Map<string, { descricao: string; score: number }>();
  for (const a of agrupadoresBrutos) {
    const p4 = a.codigo.slice(0, 4);
    const score = -a.rank * (PESO_NIVEL[a.nivel] ?? 0.75);
    const atual = melhorPorPrefixo.get(p4);
    if (!atual || score > atual.score) {
      melhorPorPrefixo.set(p4, { descricao: a.descricao, score });
    }
  }

  const posicoes = [...melhorPorPrefixo.entries()]
    .map(([codigo, v]) => ({ codigo, descricao: v.descricao, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPosicoes);

  // --- Estágio 2: itens ----------------------------------------------------
  // (a) itens que casam diretamente pelo próprio texto
  const itensDiretos = await prisma.$queryRawUnsafe<Array<{ codigo: string; rank: number }>>(
    `SELECT codigo, bm25("NcmFts", 0, 0, 10.0, 4.0, 25.0) AS rank
     FROM "NcmFts"
     WHERE "NcmFts" MATCH ? AND nivel = 'item'
     ORDER BY rank
     LIMIT ?`,
    match,
    limite * 2,
  );
  const scoreDireto = new Map(itensDiretos.map((i) => [i.codigo, -i.rank]));

  // (b) todos os itens sob as posições vencedoras — é assim que se alcança
  //     as folhas "Outros", que não têm texto próprio para casar.
  const prefixos = posicoes.map((p) => p.codigo);
  const itensDasPosicoes = prefixos.length
    ? await prisma.ncmNomenclatura.findMany({
        where: { nivel: "item", OR: prefixos.map((p) => ({ codigo: { startsWith: p } })) },
      })
    : [];

  const codigosAlvo = new Set<string>([
    ...itensDasPosicoes.map((i) => i.codigo),
    ...itensDiretos.map((i) => i.codigo),
  ]);

  const detalhes = await prisma.ncmNomenclatura.findMany({
    where: { codigo: { in: [...codigosAlvo] } },
  });

  const scorePosicao = new Map(posicoes.map((p) => [p.codigo, p.score]));
  const capitulos = new Set(opts.capitulos?.map((c) => apenasDigitos(c).slice(0, 2)) ?? []);

  const candidatos: CandidatoNcm[] = detalhes.map((d) => {
    const via = prefixos.find((p) => d.codigo.startsWith(p)) ?? null;
    const base = via ? (scorePosicao.get(via) ?? 0) : 0;
    const proprio = scoreDireto.get(d.codigo) ?? 0;
    // A posição carrega o sinal temático; o texto próprio desempata entre irmãos.
    let score = base * 0.6 + proprio * 1.4;
    if (capitulos.size && capitulos.has(d.codigo.slice(0, 2))) score *= 1.15;
    return {
      codigo: d.codigo,
      codigoFmt: d.codigoFmt,
      descricao: d.descricao,
      caminho: d.caminho,
      score,
      viaPosicao: via,
    };
  });

  candidatos.sort((a, b) => b.score - a.score);
  return { candidatos: candidatos.slice(0, limite), posicoes, indiceDegradado: false };
}

/** Consulta direta por código — caminho rápido do importador experiente (RF-A3). */
export async function buscarPorCodigo(codigo: string) {
  const d = apenasDigitos(codigo);
  if (d.length !== 8) return null;
  const linha = await prisma.ncmNomenclatura.findUnique({ where: { codigo: d } });
  if (!linha) return null;
  return {
    codigo: linha.codigo,
    codigoFmt: linha.codigoFmt,
    descricao: linha.descricao,
    caminho: linha.caminho,
  };
}

/** Type-ahead por código parcial ou por texto. */
export async function sugerirPorPrefixo(termo: string, limite = 10) {
  const d = apenasDigitos(termo);
  if (d.length >= 2) {
    const linhas = await prisma.ncmNomenclatura.findMany({
      where: { nivel: "item", codigo: { startsWith: d } },
      take: limite,
      orderBy: { codigo: "asc" },
    });
    return linhas.map((l) => ({
      codigo: l.codigo,
      codigoFmt: l.codigoFmt,
      descricao: l.descricao,
      caminho: l.caminho,
    }));
  }
  const { candidatos } = await recuperarCandidatos({ descricao: termo, limite });
  return candidatos.map((c) => ({
    codigo: c.codigo,
    codigoFmt: c.codigoFmt,
    descricao: c.descricao,
    caminho: c.caminho,
  }));
}

/**
 * Irmãos de um código: mesmos pais, texto que os diferencia.
 * É a matéria-prima da desambiguação por atributo (RF-A2).
 */
export async function irmaosDe(codigo: string) {
  const d = apenasDigitos(codigo);
  const alvo = await prisma.ncmNomenclatura.findUnique({ where: { codigo: d } });
  if (!alvo?.parentCodigo) return [];
  return prisma.ncmNomenclatura.findMany({
    where: { parentCodigo: alvo.parentCodigo },
    orderBy: { codigo: "asc" },
  });
}

/** Formata um candidato para exibição, sempre com o texto oficial (RNF-1). */
export function rotuloOficial(c: { codigoFmt: string; caminho: string }) {
  return `${c.codigoFmt} — ${c.caminho}`;
}

export { formatarNcm };
