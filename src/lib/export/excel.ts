import ExcelJS from "exceljs";
import { formatPct } from "@/lib/format";
import type { ExportPayload } from "@/lib/export/types";

const CURRENCY_FMT = 'R$ #,##0.00';

// RF15 — exportação do resultado em Excel.
export async function gerarExcel({ resultado, descricaoProduto, createdAt }: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aliquo (protótipo)";
  wb.created = createdAt ? new Date(createdAt) : new Date();

  const ws = wb.addWorksheet("Simulação", {
    properties: { defaultColWidth: 22 },
  });
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 22 }, { width: 30 }];

  const titulo = ws.addRow(["Aliquo — Simulação Tributária e Landed Cost"]);
  titulo.font = { size: 14, bold: true, color: { argb: "FF0C447C" } };
  ws.mergeCells(`A${titulo.number}:D${titulo.number}`);
  ws.addRow([]);

  // Dados gerais
  ws.addRow(["Dados gerais"]).font = { bold: true };
  ws.addRow(["NCM", resultado.ncm]);
  if (resultado.descricaoNcm) ws.addRow(["Descrição NCM", resultado.descricaoNcm]);
  if (descricaoProduto) ws.addRow(["Produto informado", descricaoProduto]);
  ws.addRow(["UF de destino", resultado.uf]);
  ws.addRow(["Moeda", resultado.moeda]);
  ws.addRow(["Taxa de câmbio", resultado.taxaCambio]);
  const qtd = resultado.quantidade ?? 1;
  if (qtd > 1) {
    ws.addRow(["Quantidade", qtd]);
    ws.addRow(["Valor unitário (moeda)", resultado.valorUnitarioMoeda ?? resultado.fobMoeda]);
  }
  ws.addRow([qtd > 1 ? "Valor FOB total (moeda)" : "Valor FOB (moeda)", resultado.fobMoeda]);
  const rFob = ws.addRow(["Valor FOB (BRL)", resultado.fobBrl]);
  rFob.getCell(2).numFmt = CURRENCY_FMT;
  const rFrete = ws.addRow(["Frete internacional", resultado.freteInternacional]);
  rFrete.getCell(2).numFmt = CURRENCY_FMT;
  const rSeguro = ws.addRow(["Seguro internacional", resultado.seguroInternacional]);
  rSeguro.getCell(2).numFmt = CURRENCY_FMT;
  const rVa = ws.addRow(["Valor aduaneiro", resultado.valorAduaneiro]);
  rVa.getCell(2).numFmt = CURRENCY_FMT;
  rVa.font = { bold: true };
  ws.addRow([]);

  // Tributos
  const hTrib = ws.addRow(["Tributo", "Alíquota", "Base (R$)", "Valor (R$)"]);
  hTrib.font = { bold: true };
  hTrib.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F1FB" } };
  });
  for (const t of resultado.tributos) {
    const row = ws.addRow([t.rotulo, formatPct(t.aliquota), t.base, t.valor]);
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
  }
  const rTotTrib = ws.addRow(["Total de tributos", "", "", resultado.totalTributos]);
  rTotTrib.font = { bold: true };
  rTotTrib.getCell(4).numFmt = CURRENCY_FMT;
  ws.addRow([]);

  // Custos
  const hCusto = ws.addRow(["Custo variável", "", "", "Valor (R$)"]);
  hCusto.font = { bold: true };
  hCusto.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1F5EE" } };
  });
  if (resultado.custos.length === 0) {
    ws.addRow(["(nenhum custo variável informado)", "", "", 0]).getCell(4).numFmt = CURRENCY_FMT;
  }
  for (const c of resultado.custos) {
    const row = ws.addRow([c.rotulo, "", "", c.valor]);
    row.getCell(4).numFmt = CURRENCY_FMT;
  }
  const rTotCusto = ws.addRow(["Total de custos", "", "", resultado.totalCustos]);
  rTotCusto.font = { bold: true };
  rTotCusto.getCell(4).numFmt = CURRENCY_FMT;
  ws.addRow([]);

  // Landed cost
  const rLanded = ws.addRow(["LANDED COST (custo total de nacionalização)", "", "", resultado.landedCost]);
  rLanded.font = { bold: true, size: 12, color: { argb: "FF0C447C" } };
  rLanded.getCell(4).numFmt = CURRENCY_FMT;
  ws.addRow([]);

  // Avisos / disclaimer
  ws.addRow(["Avisos"]).font = { bold: true };
  ws.addRow([
    "Protótipo Aliquo — alíquotas e classificação de NCM são de amostra e NÃO substituem a fonte oficial (Receita Federal).",
  ]);
  for (const a of resultado.avisos) ws.addRow([`• ${a}`]);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
