/**
 * Helpers de código NCM — compartilhados entre app e scripts de ingestão.
 *
 * A nomenclatura oficial usa códigos de comprimento variável, cada um um nível
 * da árvore do Sistema Harmonizado:
 *
 *   2 dígitos  "01"          capítulo
 *   4 dígitos  "0101"        posição
 *   5-7        "01012"       subposição
 *   8          "01012100"    item (a NCM propriamente dita)
 */

export type NivelNcm = "capitulo" | "posicao" | "subposicao" | "item";

/** Só os dígitos: "8508.11.00" -> "85081100". */
export function apenasDigitos(codigo: string): string {
  return (codigo || "").replace(/\D/g, "");
}

/** Nível a partir da quantidade de dígitos. */
export function nivelDe(codigo: string): NivelNcm {
  const n = apenasDigitos(codigo).length;
  if (n <= 2) return "capitulo";
  if (n <= 4) return "posicao";
  if (n <= 7) return "subposicao";
  return "item";
}

/**
 * Formata uma NCM de 8 dígitos como "0000.00.00".
 * Códigos mais curtos (níveis superiores) são devolvidos como vieram.
 */
export function formatarNcm(codigo: string): string {
  const d = apenasDigitos(codigo);
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

/** True apenas para NCM completa de 8 dígitos. */
export function ehNcmCompleta(codigo: string): boolean {
  return apenasDigitos(codigo).length === 8;
}

/**
 * Normaliza texto para busca: minúsculo, sem acento, sem pontuação.
 * Precisa bater com `remove_diacritics 2` do tokenizer do FTS5.
 */
export function normalizarTexto(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove os travessões de indentação do texto oficial.
 * "-- De potência não superior a 1.500 W" -> "De potência não superior a 1.500 W"
 */
export function limparTravessoes(descricao: string): string {
  return (descricao || "")
    .replace(/^[\s\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefixos ancestrais de um código, do mais curto ao mais longo,
 * excluindo ele mesmo. Usado para achar o pai na árvore.
 */
export function prefixosAncestrais(codigo: string): string[] {
  const d = apenasDigitos(codigo);
  const out: string[] = [];
  for (let i = 2; i < d.length; i++) out.push(d.slice(0, i));
  return out;
}

/**
 * Remove tags HTML do texto oficial.
 * A publicação da Receita traz marcação como "<i>smartphones</i>" em 1.057
 * descrições; ela polui o tokenizer do FTS e vaza para a tela.
 */
export function limparHtml(s: string): string {
  return (s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
