import ExcelJS from "exceljs";
import { formatPct } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import type { ExportPayload } from "@/lib/export/types";
import { ABA_DADOS, COLUNAS } from "@/lib/migracao/template";

const MOEDA_FMT = "R$ #,##0.00";

/** Exportação em Excel com as mesmas garantias de rastreabilidade do PDF. */
export async function gerarExcel({
  resultado,
  apelido,
  createdAt,
  importacaoId,
  entrada,
}: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aliquo";
  wb.created = createdAt ? new Date(createdAt) : new Date();

  const ws = wb.addWorksheet("Simulação", { properties: { defaultColWidth: 22 } });
  ws.columns = [{ width: 36 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 42 }];

  const titulo = ws.addRow(["Aliquo — Simulação de custo de importação"]);
  titulo.font = { size: 14, bold: true, color: { argb: "FF0B6B7C" } };
  ws.mergeCells(`A${titulo.number}:E${titulo.number}`);
  if (apelido) ws.addRow([apelido]);
  ws.addRow([]);

  if (resultado.provisorio) {
    const aviso = ws.addRow([
      "SIMULAÇÃO PROVISÓRIA — falta alíquota oficial para ao menos um item. O custo total não é confiável.",
    ]);
    aviso.font = { bold: true, color: { argb: "FFB23A2E" } };
    ws.mergeCells(`A${aviso.number}:E${aviso.number}`);
    ws.addRow([]);
  }

  ws.addRow(["Dados da importação"]).font = { bold: true };
  ws.addRow(["UF de destino", resultado.uf || "não informada"]);
  ws.addRow(["Regime tributário", resultado.regime.replace(/_/g, " ")]);
  ws.addRow(["Moeda", resultado.moeda]);
  // Número cheio com formato explícito: no "Geral" a coluna estreita pode
  // exibir 5,20 e refazer na planilha o erro que corrigimos na tela.
  ws.addRow(["Taxa de câmbio", resultado.taxaCambio]).getCell(2).numFmt = "0.0000";
  ws.addRow(["Fonte do câmbio", resultado.fx?.fonte ?? "-"]);
  if (importacaoId) ws.addRow(["Identificador", importacaoId]);
  ws.addRow([]);

  for (const item of resultado.itens) {
    const cab = ws.addRow([
      resultado.itens.length > 1
        ? `Item ${item.ordem + 1} — NCM ${formatarNcm(item.ncm)}`
        : `NCM ${formatarNcm(item.ncm)}`,
    ]);
    cab.font = { bold: true };

    if (item.descricaoProduto) ws.addRow(["Produto informado", item.descricaoProduto]);
    if (item.caminhoOficial) ws.addRow(["Classificação oficial", item.caminhoOficial]);
    ws.addRow(["Quantidade", item.quantidade]);
    ws.addRow(["Valor unitário", item.valorUnitarioMoeda]);
    ws.addRow(["FOB (BRL)", item.fobBrl]).getCell(2).numFmt = MOEDA_FMT;
    if (item.freteRateado) ws.addRow(["Frete rateado", item.freteRateado]).getCell(2).numFmt = MOEDA_FMT;
    if (item.seguroRateado)
      ws.addRow(["Seguro rateado", item.seguroRateado]).getCell(2).numFmt = MOEDA_FMT;
    ws.addRow(["Valor aduaneiro", item.valorAduaneiro]).getCell(2).numFmt = MOEDA_FMT;

    const head = ws.addRow(["Tributo", "Alíquota", "Base", "Valor", "Fonte da alíquota / fundamento"]);
    head.font = { bold: true };
    head.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F6" } };
    });

    for (const t of item.tributos) {
      const r = ws.addRow([
        t.rotulo,
        formatPct(t.aliquota),
        t.base,
        t.valor,
        `${t.fonteAliquota} — ${t.fonteLegal}`,
      ]);
      r.getCell(3).numFmt = MOEDA_FMT;
      r.getCell(4).numFmt = MOEDA_FMT;
    }

    const tot = ws.addRow(["Total de tributos", "", "", item.totalTributos]);
    tot.font = { bold: true };
    tot.getCell(4).numFmt = MOEDA_FMT;

    for (const c of item.custosRateados) {
      const r = ws.addRow([
        c.rotulo + (c.criterioRateio ? ` (rateio por ${c.criterioRateio})` : ""),
        "",
        "",
        c.valor,
      ]);
      r.getCell(4).numFmt = MOEDA_FMT;
    }

    for (const b of item.bloqueios) {
      const r = ws.addRow([`PENDÊNCIA: ${b.mensagem}`]);
      r.font = { color: { argb: "FFB23A2E" }, bold: true };
    }
    ws.addRow([]);
  }

  ws.addRow(["Consolidado"]).font = { bold: true };
  const linhas: Array<[string, number]> = [
    ["Valor aduaneiro total", resultado.valorAduaneiroTotal],
    ["Total de tributos", resultado.totalTributos],
    ["Total de custos", resultado.totalCustos],
    ["LANDED COST", resultado.landedCost],
  ];
  for (const [k, v] of linhas) {
    const r = ws.addRow([k, "", "", v]);
    r.getCell(4).numFmt = MOEDA_FMT;
    if (k === "LANDED COST") r.font = { bold: true, size: 12 };
  }
  if (resultado.creditosRecuperaveis.length) {
    const r = ws.addRow(["Custo efetivo (após créditos)", "", "", resultado.landedCostEfetivo]);
    r.getCell(4).numFmt = MOEDA_FMT;
  }
  ws.addRow([]);

  if (resultado.avisos.length) {
    ws.addRow(["Avisos"]).font = { bold: true };
    for (const a of resultado.avisos) ws.addRow([a]);
    ws.addRow([]);
  }

  ws.addRow(["Rastreabilidade"]).font = { bold: true };
  if (resultado.baseAto) ws.addRow(["Base NCM", `${resultado.baseAto} (${resultado.baseVigenteEm ?? "-"})`]);
  ws.addRow(["Regras de cálculo", `${resultado.rulesetRotulo} [${resultado.rulesetId}]`]);
  if (resultado.fx) {
    ws.addRow(["Câmbio", `${resultado.fx.fonte} · referência ${resultado.fx.dataRef ?? "-"}`]);
  }
  ws.addRow(["Data de referência", resultado.dataReferencia]);
  ws.addRow([]);
  ws.addRow([
    "Simulação gerada automaticamente a partir de bases públicas. Não constitui classificação fiscal oficial nem parecer tributário.",
  ]);

  // ---- Aba de reimportação ----
  // Mesmo formato do modelo de migração, para que este próprio arquivo possa
  // ser devolvido ao sistema — é o caminho de migrar histórico entre contas.
  if (entrada) {
    const wsDados = wb.addWorksheet(ABA_DADOS);
    wsDados.columns = COLUNAS.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura }));
    const cab = wsDados.getRow(1);
    cab.font = { bold: true };
    cab.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F6" } };
    });

    const custo = (chave: string) => entrada.custos?.find((c) => c.chave === chave)?.valor ?? 0;
    const referencia = apelido || importacaoId || "Importação";

    for (const item of entrada.itens) {
      wsDados.addRow({
        referencia,
        data: (createdAt ? new Date(createdAt) : new Date()).toISOString().slice(0, 10),
        uf: entrada.uf,
        moeda: entrada.moeda,
        taxaCambio: entrada.taxaCambio,
        regime: resultado.regime,
        incoterm: "FOB",
        ncm: formatarNcm(item.ncm),
        descricao: item.descricaoProduto ?? "",
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitarioMoeda,
        pesoLiquidoKg: item.pesoLiquidoKg ?? "",
        frete: custo("frete"),
        seguro: custo("seguro"),
        siscomex: custo("siscomex"),
        afrmm: custo("afrmm"),
        thc: custo("thc"),
        armazenagem: custo("armazenagem"),
        despachante: custo("despachante"),
        outros: custo("outros"),
        criterioRateio: entrada.custos?.[0]?.criterioRateio ?? "valor",
        landedCostOriginal: resultado.landedCost,
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
