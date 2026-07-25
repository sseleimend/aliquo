import PDFDocument from "pdfkit";
import { formatBRL, formatData, formatMoeda, formatPct } from "@/lib/format";
import type { ExportPayload } from "@/lib/export/types";

// RF15 — exportação do resultado em PDF (pdfkit, imperativo, JS puro).
export async function gerarPdf({
  resultado,
  descricaoProduto,
  createdAt,
}: ExportPayload): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const contentW = right - left;

    const ACCENT = "#0c447c";
    const INK = "#1f1e1c";
    const MUTED = "#8a887f";

    // Cabeçalho
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(16);
    doc.text("Aliquo — Simulação Tributária e Landed Cost", { align: "left" });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    doc.text(`Protótipo · Gerado em ${formatData(createdAt ?? new Date())}`);
    doc.moveDown(0.8);

    const kv = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(k, left, y, { width: 150 });
      doc.fillColor(INK).font("Helvetica").fontSize(9).text(v, left + 155, y, { width: contentW - 155 });
      doc.moveDown(0.2);
    };

    const secao = (titulo: string) => {
      doc.moveDown(0.6);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(titulo);
      doc.moveDown(0.3);
    };

    secao("Dados gerais");
    kv("NCM", resultado.ncm);
    if (resultado.descricaoNcm) kv("Descrição NCM", resultado.descricaoNcm);
    if (descricaoProduto) kv("Produto informado", descricaoProduto);
    kv("UF de destino", resultado.uf);
    kv("Câmbio", `1 ${resultado.moeda} = ${formatBRL(resultado.taxaCambio)}`);
    kv(
      "Valor FOB",
      `${formatMoeda(resultado.fobMoeda, resultado.moeda)} = ${formatBRL(resultado.fobBrl)}`,
    );
    kv("Frete internacional", formatBRL(resultado.freteInternacional));
    kv("Seguro internacional", formatBRL(resultado.seguroInternacional));
    kv("Valor aduaneiro", formatBRL(resultado.valorAduaneiro));

    // Colunas da tabela de tributos
    const cols = { rot: left, aliq: left + 250, base: left + 330, val: left + 440 };
    const linhaTabela = (
      a: string,
      b: string,
      c: string,
      d: string,
      opts: { bold?: boolean; header?: boolean } = {},
    ) => {
      const y = doc.y;
      doc
        .font(opts.bold || opts.header ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.header ? 8 : 9)
        .fillColor(opts.header ? MUTED : INK);
      doc.text(a, cols.rot, y, { width: 240 });
      doc.text(b, cols.aliq, y, { width: 70, align: "right" });
      doc.text(c, cols.base, y, { width: 100, align: "right" });
      doc.text(d, cols.val, y, { width: contentW - (cols.val - left), align: "right" });
      doc.moveDown(0.35);
    };

    secao("Tributos");
    linhaTabela("Tributo", "Alíquota", "Base", "Valor", { header: true });
    for (const t of resultado.tributos) {
      linhaTabela(t.rotulo, formatPct(t.aliquota), formatBRL(t.base), formatBRL(t.valor));
    }
    linhaTabela("Total de tributos", "", "", formatBRL(resultado.totalTributos), { bold: true });

    secao("Custos variáveis");
    if (resultado.custos.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Nenhum custo variável informado.");
    } else {
      for (const c of resultado.custos) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(9).fillColor(INK).text(c.rotulo, cols.rot, y, { width: 300 });
        doc.text(formatBRL(c.valor), cols.val, y, {
          width: contentW - (cols.val - left),
          align: "right",
        });
        doc.moveDown(0.35);
      }
    }
    {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Total de custos", cols.rot, y, { width: 300 });
      doc.text(formatBRL(resultado.totalCustos), cols.val, y, {
        width: contentW - (cols.val - left),
        align: "right",
      });
      doc.moveDown(0.6);
    }

    // Landed cost em destaque
    const boxY = doc.y;
    doc.roundedRect(left, boxY, contentW, 34, 5).fill("#e6f1fb");
    doc
      .fillColor(ACCENT)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("LANDED COST (custo total de nacionalização)", left + 12, boxY + 11, { width: 320 });
    doc
      .fontSize(14)
      .text(formatBRL(resultado.landedCost), left, boxY + 9, { width: contentW - 12, align: "right" });
    doc.y = boxY + 34;
    doc.moveDown(1);

    // Disclaimer + avisos
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#791f1f")
      .text(
        "Protótipo Aliquo — alíquotas e classificação de NCM são valores de amostra e NÃO " +
          "substituem a fonte oficial (Receita Federal). Sem valor fiscal ou jurídico.",
        { width: contentW },
      );
    for (const a of resultado.avisos) {
      doc.fillColor("#633806").text(`• ${a}`, { width: contentW });
    }

    doc.end();
  });
}
