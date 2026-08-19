import PDFDocument from "pdfkit";
import { formatBRL, formatData, formatMoeda, formatPct } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import type { ExportPayload } from "@/lib/export/types";
import { montarPayloadPdf } from "@/lib/migracao/payload";

/**
 * PDF do resultado (RF-C3) com rastreabilidade fiscal completa (RNF-1/RNF-6).
 *
 * Cada linha de tributo imprime a alíquota, a base, o valor, a FONTE da
 * alíquota e o fundamento legal. O rodapé carrega o ato da base, a data de
 * vigência, a cotação usada com data/fonte e a versão do conjunto de regras —
 * é o que permite reproduzir o número meses depois.
 *
 * Quando falta alíquota oficial, o documento sai carimbado como PROVISÓRIO.
 * Um PDF com aparência de laudo e números inventados é o pior resultado
 * possível para um produto que vende confiança.
 */
export async function gerarPdf({
  resultado,
  apelido,
  createdAt,
  importacaoId,
  entrada,
}: ExportPayload): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // O payload de reimportação vai nos METADADOS, não no layout. Reparsear a
    // página impressa seria frágil a qualquer mudança visual; um campo de
    // info é estável e independente do desenho.
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Aliquo — ${apelido ?? "simulação de importação"}`,
        Author: "Aliquo",
        Subject: "Simulação de custo de importação",
        ...(entrada
          ? { AliquoDados: montarPayloadPdf({ resultado, entrada, apelido, importacaoId, createdAt }) }
          : {}),
        // `AliquoDados` não está no tipo do pdfkit (que só declara os campos
        // padrão do PDF), mas campos extras no Info são válidos na spec.
      } as PDFKit.PDFDocumentOptions["info"],
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;

    const ACCENT = "#0b6b7c";
    const INK = "#18222f";
    const MUTED = "#6b7a89";
    const STAMP = "#b23a2e";

    // ---------- Cabeçalho ----------
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(16);
    doc.text("Aliquo — Simulação de custo de importação", { align: "left" });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    doc.text(`Gerado em ${formatData(createdAt ?? new Date())}`);
    if (apelido) doc.text(apelido);
    doc.moveDown(0.6);

    // ---------- Carimbo de provisório ----------
    if (resultado.provisorio) {
      const y = doc.y;
      doc.rect(left, y, contentW, 46).fill("#b23a2e14");
      doc.fillColor(STAMP).font("Helvetica-Bold").fontSize(11);
      doc.text("SIMULAÇÃO PROVISÓRIA", left + 10, y + 8, { width: contentW - 20 });
      doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      doc.text(
        "Falta alíquota oficial para ao menos um item. O custo total abaixo NÃO é confiável " +
          "enquanto as pendências não forem resolvidas.",
        left + 10,
        y + 24,
        { width: contentW - 20 },
      );
      doc.y = y + 54;
    }

    const kv = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(k, left, y, { width: 130 });
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(8.5)
        .text(v, left + 135, y, { width: contentW - 135 });
      doc.moveDown(0.25);
    };

    const secao = (titulo: string) => {
      doc.moveDown(0.5);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5).text(titulo);
      doc.moveDown(0.25);
    };

    // ---------- Dados gerais ----------
    secao("Dados da importação");
    kv("UF de destino", resultado.uf || "não informada");
    kv("Regime tributário", resultado.regime.replace(/_/g, " "));
    kv(
      "Câmbio aplicado",
      `1 ${resultado.moeda} = ${formatBRL(resultado.taxaCambio)}` +
        (resultado.fx?.fonte ? `  ·  ${resultado.fx.fonte}` : "") +
        (resultado.fx?.stale ? "  ·  COTAÇÃO DESATUALIZADA" : ""),
    );
    if (importacaoId) kv("Identificador", importacaoId);

    // ---------- Itens ----------
    for (const item of resultado.itens) {
      secao(
        resultado.itens.length > 1
          ? `Item ${item.ordem + 1} — NCM ${formatarNcm(item.ncm)}`
          : `NCM ${formatarNcm(item.ncm)}`,
      );

      if (item.descricaoProduto) kv("Produto informado", item.descricaoProduto);
      // O texto OFICIAL é o que dá validade à classificação (RNF-1).
      if (item.caminhoOficial) kv("Classificação oficial", item.caminhoOficial);

      kv("Quantidade", String(item.quantidade));
      kv("Valor unitário", formatMoeda(item.valorUnitarioMoeda, resultado.moeda));
      kv("FOB", `${formatMoeda(item.fobMoeda, resultado.moeda)}  =  ${formatBRL(item.fobBrl)}`);
      if (item.freteRateado) kv("Frete (rateado)", formatBRL(item.freteRateado));
      if (item.seguroRateado) kv("Seguro (rateado)", formatBRL(item.seguroRateado));
      kv("Valor aduaneiro", formatBRL(item.valorAduaneiro));

      // Tabela de tributos
      doc.moveDown(0.3);
      const cols = [left, left + 150, left + 215, left + 300, left + 385];
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
      const yh = doc.y;
      doc.text("TRIBUTO", cols[0], yh, { width: 145 });
      doc.text("ALÍQ.", cols[1], yh, { width: 60 });
      doc.text("BASE", cols[2], yh, { width: 80 });
      doc.text("VALOR", cols[3], yh, { width: 80 });
      doc.text("FONTE DA ALÍQUOTA", cols[4], yh, { width: contentW - 385 });
      doc.moveDown(0.4);
      doc
        .strokeColor("#d9e0e8")
        .lineWidth(0.5)
        .moveTo(left, doc.y)
        .lineTo(right, doc.y)
        .stroke();
      doc.moveDown(0.3);

      for (const t of item.tributos) {
        const y = doc.y;
        doc.fillColor(INK).font("Helvetica").fontSize(8);
        doc.text(t.rotulo, cols[0], y, { width: 145 });
        doc.text(formatPct(t.aliquota), cols[1], y, { width: 60 });
        doc.text(formatBRL(t.base), cols[2], y, { width: 80 });
        doc.font("Helvetica-Bold").text(formatBRL(t.valor), cols[3], y, { width: 80 });
        doc.font("Helvetica").fillColor(MUTED).fontSize(7);
        doc.text(t.fonteAliquota, cols[4], y, { width: contentW - 385 });
        doc.moveDown(0.15);
        // Fundamento legal em linha própria, miúdo.
        doc.fillColor(MUTED).fontSize(6.5).text(t.fonteLegal, cols[0], doc.y, { width: contentW });
        doc.moveDown(0.35);
      }

      doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5);
      doc.text(`Total de tributos: ${formatBRL(item.totalTributos)}`, left, doc.y, {
        width: contentW,
        align: "right",
      });
      doc.moveDown(0.3);

      if (item.custosRateados.length) {
        doc.fillColor(MUTED).font("Helvetica").fontSize(8);
        for (const c of item.custosRateados) {
          doc.text(
            `${c.rotulo}${c.criterioRateio ? ` (rateio por ${c.criterioRateio})` : ""}: ${formatBRL(c.valor)}`,
            { width: contentW },
          );
        }
        doc.moveDown(0.2);
      }

      if (item.bloqueios.length) {
        doc.fillColor(STAMP).font("Helvetica-Bold").fontSize(8);
        for (const b of item.bloqueios) doc.text(`PENDÊNCIA: ${b.mensagem}`, { width: contentW });
        doc.moveDown(0.2);
      }
    }

    // ---------- Consolidado ----------
    secao("Custo total de nacionalização");
    kv("Valor aduaneiro total", formatBRL(resultado.valorAduaneiroTotal));
    kv("Total de tributos", formatBRL(resultado.totalTributos));
    kv("Total de custos", formatBRL(resultado.totalCustos));

    doc.moveDown(0.3);
    doc.fillColor(resultado.provisorio ? STAMP : ACCENT).font("Helvetica-Bold").fontSize(14);
    doc.text(
      `LANDED COST: ${formatBRL(resultado.landedCost)}${resultado.provisorio ? "  (PROVISÓRIO)" : ""}`,
      { width: contentW },
    );
    doc.moveDown(0.2);

    if (resultado.creditosRecuperaveis.length) {
      doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      doc.text(
        `Custo efetivo após créditos recuperáveis no regime ${resultado.regime.replace(/_/g, " ")}: ` +
          formatBRL(resultado.landedCostEfetivo),
        { width: contentW },
      );
      doc.fillColor(MUTED).fontSize(7.5);
      doc.text(
        "Créditos: " +
          resultado.creditosRecuperaveis.map((c) => `${c.rotulo} ${formatBRL(c.valor)}`).join(" · "),
        { width: contentW },
      );
    }

    // ---------- Avisos ----------
    if (resultado.avisos.length) {
      secao("Avisos");
      doc.fillColor(INK).font("Helvetica").fontSize(8);
      for (const a of resultado.avisos) doc.text(`• ${a}`, { width: contentW });
    }

    // ---------- Rastreabilidade ----------
    secao("Rastreabilidade");
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5);
    const linhas = [
      resultado.baseAto ? `Base NCM: ${resultado.baseAto} (${resultado.baseVigenteEm ?? "-"})` : null,
      `Regras de cálculo: ${resultado.rulesetRotulo} [${resultado.rulesetId}]`,
      resultado.fx
        ? `Câmbio: ${resultado.fx.fonte} · referência ${resultado.fx.dataRef ?? "-"}` +
          (resultado.fx.asOf ? ` · cotado em ${formatData(resultado.fx.asOf)}` : "")
        : null,
      `Data de referência do cálculo: ${formatData(resultado.dataReferencia)}`,
    ].filter(Boolean) as string[];
    for (const l of linhas) doc.text(l, { width: contentW });

    doc.moveDown(0.6);
    doc.fillColor(MUTED).fontSize(7);
    doc.text(
      "Este documento é uma SIMULAÇÃO gerada automaticamente a partir de bases públicas. " +
        "Não constitui classificação fiscal oficial nem parecer tributário. A decisão final " +
        "e a conferência na fonte oficial são de responsabilidade do importador.",
      { width: contentW },
    );

    doc.end();
  });
}
