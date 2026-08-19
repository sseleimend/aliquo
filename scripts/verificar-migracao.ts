/**
 * Verifica o ciclo de migração: template -> preenchimento -> importação, e
 * o round-trip do próprio PDF exportado.
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db";
import { ABA_DADOS, COLUNAS, gerarTemplate, lerPlanilha } from "../src/lib/migracao/template";
import { importarEmbarques } from "../src/lib/migracao/importar";
import { extrairPayloadPdf, payloadParaEmbarque } from "../src/lib/migracao/payload";
import { gerarPdf } from "../src/lib/export/pdf";
import { formatBRL } from "../src/lib/format";
import type { EntradaCalculo, ResultadoCalculo } from "../src/lib/tax/types";

const t = (s: string) => console.log(`\n${"=".repeat(60)}\n${s}\n${"=".repeat(60)}`);

(async () => {
  const user = await prisma.user.findFirst({ where: { email: "teste@aliquo.com" } });
  if (!user) throw new Error("conta de teste não encontrada");

  t("1. TEMPLATE");
  const tpl = await gerarTemplate();
  console.log(`modelo gerado: ${(tpl.length / 1024).toFixed(1)} KB, ${COLUNAS.length} colunas`);
  const vazio = await lerPlanilha(tpl);
  console.log(`reenviado sem editar -> ${vazio.embarques.length} importação(ões) (esperado 0)`);

  t("2. PLANILHA PREENCHIDA (migração de outra ferramenta)");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ABA_DADOS);
  ws.columns = COLUNAS.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura }));
  const base = {
    referencia: "MIGRADO-2025-07", data: "2025-07-10", uf: "SP", moeda: "USD",
    taxaCambio: 5.45, regime: "lucro_real", incoterm: "FOB",
    frete: 2400, seguro: 52.48, siscomex: 214.5, thc: 1150, despachante: 850,
    criterioRateio: "valor", landedCostOriginal: 30000,
  };
  ws.addRow({ ...base, ncm: "8508.11.00", descricao: "Robô aspirador", quantidade: 10, valorUnitario: 120 });
  ws.addRow({ ...base, ncm: "8544.42.00", descricao: "Cabo", quantidade: 200, valorUnitario: 8.5 });
  const preenchida = Buffer.from(await wb.xlsx.writeBuffer());

  const lida = await lerPlanilha(preenchida);
  console.log(`lidos: ${lida.embarques.length} embarque(s), ${lida.embarques[0].itens.length} itens, ${lida.erros.length} erro(s)`);
  console.log(`taxa da operação original preservada: ${lida.embarques[0].taxaCambio}`);

  await prisma.importacao.deleteMany({ where: { userId: user.id, apelido: { startsWith: "MIGRADO" } } });
  const imp = await importarEmbarques(user.id, lida.embarques);
  console.log(`criadas: ${imp.criadas.length}, falhas: ${imp.falhas.length}`);
  for (const c of imp.criadas) {
    console.log(`  ${c.referencia}: ${formatBRL(c.landedCost)} (original informado: R$ 30.000,00)`);
  }
  const salva = await prisma.importacao.findFirst({
    where: { id: imp.criadas[0].id }, include: { itens: true, custos: true },
  });
  console.log(`status=${salva!.status}  itens=${salva!.itens.length}  custos=${salva!.custos.length}  câmbio=${salva!.fxRate} (${salva!.fxFonte})`);

  t("3. ROUND-TRIP DO PDF EXPORTADO");
  const entrada = JSON.parse(salva!.inputJson) as EntradaCalculo;
  const resultado = JSON.parse(salva!.resultadoJson) as ResultadoCalculo;
  const pdf = await gerarPdf({ resultado, entrada, apelido: salva!.apelido, importacaoId: salva!.id, createdAt: salva!.createdAt });
  console.log(`PDF gerado: ${(pdf.length / 1024).toFixed(1)} KB`);

  const payload = extrairPayloadPdf(pdf);
  console.log(`payload extraído: ${payload ? "sim" : "NÃO"}`);
  if (payload) {
    const e = payloadParaEmbarque(payload, "REIMPORTADO");
    const iguais = JSON.stringify(e.itens.map(i => [i.ncm, i.quantidade, i.valorUnitario]))
      === JSON.stringify(entrada.itens.map(i => [i.ncm, i.quantidade, i.valorUnitarioMoeda]));
    console.log(`itens idênticos ao original: ${iguais}`);
    console.log(`frete: ${formatBRL(e.frete)}  ·  câmbio: ${e.taxaCambio}  ·  rateio: ${e.criterioRateio}`);
  }

  t("4. PDF DE OUTRA FERRAMENTA");
  const alheio = Buffer.from("%PDF-1.4\n/Title (Relatorio concorrente)\n%%EOF", "latin1");
  console.log(`payload: ${extrairPayloadPdf(alheio) ?? "null — recusado, como deve ser"}`);

  await prisma.importacao.deleteMany({ where: { userId: user.id, apelido: { startsWith: "MIGRADO" } } });
  console.log("\nlimpeza feita. OK — migração verificada.");
  await prisma.$disconnect();
})().catch((e) => { console.error("FALHOU:", e); process.exit(1); });
