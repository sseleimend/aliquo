// Utilidades de formatação (compartilhadas entre frontend e exportação).

export function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(valor) ? valor : 0);
}

export function formatMoeda(valor: number, moeda: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
    }).format(Number.isFinite(valor) ? valor : 0);
  } catch {
    return `${moeda} ${valor.toFixed(2)}`;
  }
}

/**
 * Taxa de câmbio — 4 casas, como o Banco Central publica a PTAX.
 *
 * NÃO use `formatBRL` aqui: taxa não é dinheiro. Arredondar 5,2043 para
 * "R$ 5,20" transforma a linha "US$ 1.200,00 × R$ 5,20 = R$ 6.245,16" numa
 * conta que não fecha na calculadora do usuário — e conferir a conta é
 * exatamente o que o produto promete.
 */
export function formatTaxa(valor: number): string {
  const n = Number.isFinite(valor) ? valor : 0;
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

export function formatPct(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatData(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
