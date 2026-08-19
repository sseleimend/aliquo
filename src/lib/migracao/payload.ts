/**
 * Payload de reimportação embutido nos arquivos exportados.
 *
 * Permite que o PDF e o Excel que o próprio Aliquo gera sejam devolvidos ao
 * sistema sem perda — o caso de migrar o histórico entre contas.
 *
 * Vai nos METADADOS do PDF (e numa aba técnica do Excel), nunca no layout:
 * reparsear a página impressa quebraria a cada ajuste visual, enquanto um
 * campo de info é estável. É codificado em base64 para caber num literal PDF
 * sem colidir com parênteses, acentos ou quebras de linha.
 */

import type { EntradaCalculo, ResultadoCalculo } from "@/lib/tax/types";
import type { EmbarqueImportado } from "./template";

export const VERSAO_PAYLOAD = 1;

export interface PayloadExportado {
  v: number;
  apelido?: string | null;
  importacaoId?: string;
  criadoEm?: string;
  entrada: EntradaCalculo;
  /** Só para referência do usuário; não substitui o recálculo. */
  landedCostOriginal?: number;
}

export function montarPayloadPdf(args: {
  resultado: ResultadoCalculo;
  entrada: EntradaCalculo;
  apelido?: string | null;
  importacaoId?: string;
  createdAt?: string | Date;
}): string {
  const payload: PayloadExportado = {
    v: VERSAO_PAYLOAD,
    apelido: args.apelido ?? null,
    importacaoId: args.importacaoId,
    criadoEm: args.createdAt
      ? new Date(args.createdAt).toISOString()
      : new Date().toISOString(),
    entrada: args.entrada,
    landedCostOriginal: args.resultado.landedCost,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Extrai o payload do PDF lendo o dicionário de informações do arquivo.
 *
 * O pdfkit grava o Info em texto plano, então uma varredura pelo campo basta —
 * sem precisar de um parser completo de PDF só para ler um metadado.
 */
export function extrairPayloadPdf(buffer: Buffer): PayloadExportado | null {
  const texto = buffer.toString("latin1");

  // O pdfkit grava strings do Info como OBJETO INDIRETO: o dicionário traz
  // `/AliquoDados 13 0 R` e o valor mora em `13 0 obj (...) endobj`. Aceitamos
  // as duas formas porque a spec permite ambas e outros geradores usam inline.
  let bruto: string | null = null;

  const inline = texto.match(/\/AliquoDados\s*\(([^)]*)\)/);
  if (inline) {
    bruto = inline[1];
  } else {
    const ref = texto.match(/\/AliquoDados\s+(\d+)\s+(\d+)\s+R/);
    if (ref) {
      const objeto = new RegExp(`(?:^|[\\r\\n])${ref[1]}\\s+${ref[2]}\\s+obj\\s*\\(([^)]*)\\)`, "m");
      bruto = texto.match(objeto)?.[1] ?? null;
    }
  }

  if (!bruto) return null;

  try {
    const json = Buffer.from(bruto.replace(/\s+/g, ""), "base64").toString("utf8");
    const p = JSON.parse(json) as PayloadExportado;
    if (!p || typeof p !== "object" || !p.entrada) return null;
    return p;
  } catch {
    return null;
  }
}

/** Converte o payload para o mesmo formato que a planilha produz. */
export function payloadParaEmbarque(p: PayloadExportado, referencia: string): EmbarqueImportado {
  const e = p.entrada;
  const custo = (chave: string) => e.custos?.find((c) => c.chave === chave)?.valor ?? 0;

  return {
    referencia,
    data: p.criadoEm?.slice(0, 10),
    uf: e.uf,
    moeda: e.moeda,
    taxaCambio: e.taxaCambio,
    regime: "lucro_real",
    incoterm: "FOB",
    frete: custo("frete"),
    seguro: custo("seguro"),
    siscomex: custo("siscomex"),
    afrmm: custo("afrmm"),
    thc: custo("thc"),
    armazenagem: custo("armazenagem"),
    despachante: custo("despachante"),
    outros: custo("outros"),
    criterioRateio: (e.custos?.[0]?.criterioRateio ?? "valor") as "valor" | "peso" | "quantidade",
    landedCostOriginal: p.landedCostOriginal,
    itens: e.itens.map((i) => ({
      ncm: i.ncm,
      descricao: i.descricaoProduto,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitarioMoeda,
      pesoLiquidoKg: i.pesoLiquidoKg,
    })),
    linhas: [],
  };
}
