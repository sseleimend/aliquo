/**
 * Migração de histórico — entrada e saída em planilha.
 *
 * Serve para quem está trocando de ferramenta trazer as importações passadas
 * sem redigitar. O formato é UMA LINHA POR ITEM, com os campos do embarque
 * repetidos e agrupados por uma coluna de referência — porque é assim que as
 * planilhas que as pessoas já mantêm costumam estar, e converter para duas
 * abas com chave estrangeira seria trabalho jogado no usuário.
 *
 * A mesma definição gera o template em branco e lê o arquivo preenchido, então
 * as duas pontas não podem divergir.
 */

import ExcelJS from "exceljs";
import { apenasDigitos } from "@/lib/ncm/codigo";

export const ABA_DADOS = "Importações";
/**
 * Prefixo das linhas de demonstração do modelo. Elas existem para mostrar o
 * agrupamento, mas precisam ser reconhecíveis: quem baixa o modelo e reenvia
 * sem editar não pode acabar com importações inventadas no histórico.
 */
export const PREFIXO_EXEMPLO = "EXEMPLO";
export const ABA_INSTRUCOES = "Instruções";

interface Coluna {
  chave: string;
  titulo: string;
  largura: number;
  /** Campo do embarque (repetido em todas as linhas do grupo) ou do item. */
  nivel: "embarque" | "item";
  obrigatorio?: boolean;
  ajuda: string;
  exemplo: string | number;
}

export const COLUNAS: Coluna[] = [
  {
    chave: "referencia",
    titulo: "Referência",
    largura: 22,
    nivel: "embarque",
    obrigatorio: true,
    ajuda: "Agrupa os itens de uma mesma importação. Repita o mesmo valor nas linhas do embarque.",
    exemplo: "EXEMPLO — apague esta linha",
  },
  { chave: "data", titulo: "Data", largura: 12, nivel: "embarque", ajuda: "AAAA-MM-DD. Vazio = hoje.", exemplo: "2026-03-15" },
  { chave: "uf", titulo: "UF de destino", largura: 14, nivel: "embarque", obrigatorio: true, ajuda: "Sigla de 2 letras.", exemplo: "SP" },
  { chave: "moeda", titulo: "Moeda", largura: 10, nivel: "embarque", ajuda: "USD, EUR, CNY...", exemplo: "USD" },
  {
    chave: "taxaCambio",
    titulo: "Taxa de câmbio",
    largura: 15,
    nivel: "embarque",
    ajuda: "Taxa usada na operação original. Vazio = usamos a PTAX atual.",
    exemplo: 5.2,
  },
  {
    chave: "regime",
    titulo: "Regime tributário",
    largura: 20,
    nivel: "embarque",
    ajuda: "lucro_real, lucro_presumido ou simples_nacional.",
    exemplo: "lucro_real",
  },
  { chave: "incoterm", titulo: "Incoterm", largura: 12, nivel: "embarque", ajuda: "FOB, CIF, EXW...", exemplo: "FOB" },

  { chave: "ncm", titulo: "NCM", largura: 14, nivel: "item", obrigatorio: true, ajuda: "8 dígitos. Precisa existir na base oficial.", exemplo: "8508.11.00" },
  { chave: "descricao", titulo: "Descrição do produto", largura: 34, nivel: "item", ajuda: "Texto livre.", exemplo: "Robô aspirador 60 W" },
  { chave: "quantidade", titulo: "Quantidade", largura: 12, nivel: "item", obrigatorio: true, ajuda: "Número.", exemplo: 10 },
  { chave: "valorUnitario", titulo: "Valor unitário", largura: 15, nivel: "item", obrigatorio: true, ajuda: "Na moeda da fatura.", exemplo: 120 },
  { chave: "pesoLiquidoKg", titulo: "Peso líquido (kg)", largura: 16, nivel: "item", ajuda: "Opcional. Só necessário para rateio por peso.", exemplo: 3 },

  { chave: "frete", titulo: "Frete internacional (R$)", largura: 22, nivel: "embarque", ajuda: "Compõe o valor aduaneiro.", exemplo: 2400 },
  { chave: "seguro", titulo: "Seguro internacional (R$)", largura: 23, nivel: "embarque", ajuda: "Compõe o valor aduaneiro.", exemplo: 52.48 },
  { chave: "siscomex", titulo: "Siscomex (R$)", largura: 15, nivel: "embarque", ajuda: "Entra na base do ICMS.", exemplo: 214.5 },
  { chave: "afrmm", titulo: "AFRMM (R$)", largura: 14, nivel: "embarque", ajuda: "Entra na base do ICMS.", exemplo: 0 },
  { chave: "thc", titulo: "THC (R$)", largura: 13, nivel: "embarque", ajuda: "", exemplo: 1150 },
  { chave: "armazenagem", titulo: "Armazenagem (R$)", largura: 18, nivel: "embarque", ajuda: "", exemplo: 0 },
  { chave: "despachante", titulo: "Despachante (R$)", largura: 18, nivel: "embarque", ajuda: "", exemplo: 850 },
  { chave: "outros", titulo: "Outros custos (R$)", largura: 18, nivel: "embarque", ajuda: "", exemplo: 0 },
  {
    chave: "criterioRateio",
    titulo: "Critério de rateio",
    largura: 18,
    nivel: "embarque",
    ajuda: "valor, peso ou quantidade. Vazio = valor.",
    exemplo: "valor",
  },
  {
    chave: "landedCostOriginal",
    titulo: "Landed cost original (R$)",
    largura: 24,
    nivel: "embarque",
    ajuda: "Opcional. O custo que a ferramenta anterior apurou — guardamos só como referência.",
    exemplo: "",
  },
];

export interface ItemImportado {
  ncm: string;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  pesoLiquidoKg?: number;
}

export interface EmbarqueImportado {
  referencia: string;
  data?: string;
  uf: string;
  moeda: string;
  taxaCambio?: number;
  regime: string;
  incoterm: string;
  frete: number;
  seguro: number;
  siscomex: number;
  afrmm: number;
  thc: number;
  armazenagem: number;
  despachante: number;
  outros: number;
  criterioRateio: "valor" | "peso" | "quantidade";
  landedCostOriginal?: number;
  itens: ItemImportado[];
  linhas: number[];
}

export interface ErroLinha {
  linha: number;
  campo: string;
  mensagem: string;
}

// ---------------------------------------------------------------------------
// Geração do template
// ---------------------------------------------------------------------------

export async function gerarTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aliquo";
  wb.created = new Date();

  // --- Instruções primeiro: é a aba que abre ---
  const inst = wb.addWorksheet(ABA_INSTRUCOES, { properties: { defaultColWidth: 30 } });
  inst.columns = [{ width: 30 }, { width: 90 }];

  const titulo = inst.addRow(["Aliquo — importação de histórico"]);
  titulo.font = { size: 15, bold: true, color: { argb: "FF0B6B7C" } };
  inst.addRow([]);
  [
    ["Para que serve", "Trazer importações já realizadas para o histórico, sem redigitar."],
    ["Como preencher", `Uma linha por ITEM, na aba "${ABA_DADOS}".`],
    ["Agrupamento", "Itens do mesmo embarque compartilham a coluna Referência; repita os campos do embarque em todas as linhas dele."],
    ["NCM", "Precisa existir na base oficial. Códigos inexistentes são recusados — não inventamos alíquota."],
    ["Cálculo", "Recalculamos os tributos com as alíquotas oficiais vigentes HOJE. Se a operação é antiga, os valores podem diferir do que você pagou na época."],
    ["Landed cost original", "Se você tem o número da ferramenta anterior, informe: guardamos como referência, sem misturar com o nosso cálculo."],
    ["Não apague", "A linha de cabeçalho da aba de dados. É por ela que identificamos as colunas."],
  ].forEach(([k, v]) => {
    const r = inst.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });

  inst.addRow([]);
  const cabDic = inst.addRow(["Coluna", "O que é"]);
  cabDic.font = { bold: true };
  cabDic.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F6" } };
  });
  for (const c of COLUNAS) {
    const r = inst.addRow([c.titulo + (c.obrigatorio ? " *" : ""), c.ajuda]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  inst.addRow([]);
  inst.addRow(["* obrigatório"]).font = { italic: true };

  // --- Aba de dados ---
  const ws = wb.addWorksheet(ABA_DADOS);
  ws.columns = COLUNAS.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura }));

  const cab = ws.getRow(1);
  cab.font = { bold: true };
  cab.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F6" } };
  });
  cab.commit();
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Duas linhas de exemplo do mesmo embarque, para o agrupamento ficar óbvio.
  const exemplo1: Record<string, string | number> = {};
  for (const c of COLUNAS) exemplo1[c.chave] = c.exemplo;
  const exemplo2 = {
    ...exemplo1,
    ncm: "8544.42.00",
    descricao: "Cabo de conexão",
    quantidade: 200,
    valorUnitario: 8.5,
    pesoLiquidoKg: 0.2,
  };
  for (const linha of [exemplo1, exemplo2]) {
    const r = ws.addRow(linha);
    r.font = { italic: true, color: { argb: "FF8A887F" } };
  }

  const nota = ws.addRow({
    referencia: "EXEMPLO — as linhas acima são demonstração; apague antes de enviar",
  });
  nota.font = { bold: true, color: { argb: "FFB23A2E" } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ---------------------------------------------------------------------------
// Leitura da planilha preenchida
// ---------------------------------------------------------------------------

function texto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text?: string }>).map((t) => t.text ?? "").join("");
    if (o.result != null) return String(o.result);
    if (o instanceof Date) return (o as Date).toISOString().slice(0, 10);
    if (typeof o.text === "string") return o.text;
    return "";
  }
  return String(v);
}

function numero(v: unknown): number {
  const t = texto(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

const REGIMES = ["lucro_real", "lucro_presumido", "simples_nacional"];
const CRITERIOS = ["valor", "peso", "quantidade"];

export interface ResultadoLeitura {
  embarques: EmbarqueImportado[];
  erros: ErroLinha[];
}

export async function lerPlanilha(buffer: Buffer): Promise<ResultadoLeitura> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws = wb.getWorksheet(ABA_DADOS) ?? wb.worksheets.find((w) => w.name !== ABA_INSTRUCOES);
  if (!ws) {
    return { embarques: [], erros: [{ linha: 0, campo: "arquivo", mensagem: `Aba "${ABA_DADOS}" não encontrada.` }] };
  }

  // Mapeia título -> índice pela linha de cabeçalho, para a ordem das colunas
  // não importar (as pessoas movem colunas ao adaptar a planilha delas).
  const cabecalho = ws.getRow(1);
  const indicePorChave = new Map<string, number>();
  cabecalho.eachCell((cell, col) => {
    const t = texto(cell.value).trim().toLowerCase();
    const c = COLUNAS.find((x) => x.titulo.toLowerCase() === t);
    if (c) indicePorChave.set(c.chave, col);
  });

  const faltando = COLUNAS.filter((c) => c.obrigatorio && !indicePorChave.has(c.chave));
  if (faltando.length) {
    return {
      embarques: [],
      erros: faltando.map((c) => ({
        linha: 1,
        campo: c.chave,
        mensagem: `Coluna obrigatória ausente no cabeçalho: "${c.titulo}".`,
      })),
    };
  }

  const val = (row: ExcelJS.Row, chave: string) => {
    const i = indicePorChave.get(chave);
    return i ? row.getCell(i).value : null;
  };

  const erros: ErroLinha[] = [];
  const porReferencia = new Map<string, EmbarqueImportado>();

  ws.eachRow((row, n) => {
    if (n === 1) return;

    const referencia = texto(val(row, "referencia")).trim();
    const ncmBruto = texto(val(row, "ncm")).trim();

    // Linha em branco, ou linha de demonstração do modelo deixada como veio.
    if (!referencia && !ncmBruto) return;
    if (referencia.toUpperCase().startsWith(PREFIXO_EXEMPLO)) return;

    if (!referencia) {
      erros.push({ linha: n, campo: "referencia", mensagem: "Referência vazia — sem ela não dá para agrupar os itens." });
      return;
    }

    const ncm = apenasDigitos(ncmBruto);
    if (ncm.length !== 8) {
      erros.push({ linha: n, campo: "ncm", mensagem: `NCM inválida ("${ncmBruto}") — informe 8 dígitos.` });
      return;
    }

    const quantidade = numero(val(row, "quantidade")) || 1;
    const valorUnitario = numero(val(row, "valorUnitario"));
    if (valorUnitario <= 0) {
      erros.push({ linha: n, campo: "valorUnitario", mensagem: "Valor unitário precisa ser maior que zero." });
      return;
    }

    const uf = texto(val(row, "uf")).trim().toUpperCase();
    if (uf.length !== 2) {
      erros.push({ linha: n, campo: "uf", mensagem: `UF inválida ("${uf}") — use a sigla de 2 letras.` });
      return;
    }

    const regimeBruto = texto(val(row, "regime")).trim().toLowerCase().replace(/\s+/g, "_");
    const regime = REGIMES.includes(regimeBruto) ? regimeBruto : "lucro_real";
    const criterioBruto = texto(val(row, "criterioRateio")).trim().toLowerCase();
    const criterioRateio = (CRITERIOS.includes(criterioBruto) ? criterioBruto : "valor") as
      | "valor"
      | "peso"
      | "quantidade";

    const existente = porReferencia.get(referencia);
    if (existente) {
      existente.itens.push({
        ncm,
        descricao: texto(val(row, "descricao")).trim() || undefined,
        quantidade,
        valorUnitario,
        pesoLiquidoKg: numero(val(row, "pesoLiquidoKg")) || undefined,
      });
      existente.linhas.push(n);
      return;
    }

    // Campos do embarque vêm da PRIMEIRA linha do grupo; repetições são
    // ignoradas de propósito, porque planilhas reais divergem entre linhas.
    porReferencia.set(referencia, {
      referencia,
      data: texto(val(row, "data")).trim() || undefined,
      uf,
      moeda: (texto(val(row, "moeda")).trim() || "USD").toUpperCase(),
      taxaCambio: numero(val(row, "taxaCambio")) || undefined,
      regime,
      incoterm: (texto(val(row, "incoterm")).trim() || "FOB").toUpperCase(),
      frete: numero(val(row, "frete")),
      seguro: numero(val(row, "seguro")),
      siscomex: numero(val(row, "siscomex")),
      afrmm: numero(val(row, "afrmm")),
      thc: numero(val(row, "thc")),
      armazenagem: numero(val(row, "armazenagem")),
      despachante: numero(val(row, "despachante")),
      outros: numero(val(row, "outros")),
      criterioRateio,
      landedCostOriginal: numero(val(row, "landedCostOriginal")) || undefined,
      itens: [
        {
          ncm,
          descricao: texto(val(row, "descricao")).trim() || undefined,
          quantidade,
          valorUnitario,
          pesoLiquidoKg: numero(val(row, "pesoLiquidoKg")) || undefined,
        },
      ],
      linhas: [n],
    });
  });

  return { embarques: [...porReferencia.values()], erros };
}
