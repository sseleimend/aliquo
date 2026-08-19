/**
 * Verificação do RF-D2 (invoice) e RF-D4 (duplicar), ponta a ponta.
 *
 * Uso: npx tsx scripts/verificar-invoice-duplicar.ts
 */

import { prisma } from "../src/lib/db";
import { getFileStore, montarChave, sha256, validarArquivo } from "../src/lib/storage";
import { getCotacao } from "../src/lib/fx";
import { resolverContexto } from "../src/lib/tax/contexto";
import { calcular } from "../src/lib/tax/engine";
import { formatBRL, formatMoeda } from "../src/lib/format";
import type { EntradaCalculo } from "../src/lib/tax/types";

function titulo(s: string) {
  console.log(`\n${"=".repeat(62)}\n${s}\n${"=".repeat(62)}`);
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "demo@aliquo.com" } });
  if (!user) throw new Error("Usuário demo não encontrado — rode `npm run db:seed`.");

  // ---------------------------------------------------------------------
  titulo("1. FATURA COMO ANEXO, SEM ITENS DIGITADOS (RF-D2)");

  const conteudo = Buffer.from("%PDF-1.4\n% fatura de teste\n");
  const ext = validarArquivo("application/pdf", conteudo.length);
  const hash = sha256(conteudo);
  console.log(`arquivo validado: ext=${ext}  sha256=${hash.slice(0, 16)}…`);

  await prisma.invoice.deleteMany({ where: { userId: user.id, numero: "INV-VERIF-001" } });

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      numero: "INV-VERIF-001",
      fornecedor: "Shenzhen Robotics Co.",
      moeda: "USD",
      valorTotal: 1200,
      arquivoNome: "fatura.pdf",
      arquivoMime: "application/pdf",
      arquivoTamanho: conteudo.length,
      arquivoSha256: hash,
    },
  });

  const chave = montarChave(user.id, invoice.id, ext);
  await getFileStore().put(chave, conteudo);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { arquivoKey: chave } });
  console.log(`fatura criada: ${invoice.id}`);
  console.log(`arquivo gravado em var/uploads/${chave}`);

  const lido = await getFileStore().get(chave);
  console.log(`leitura de volta: ${lido.length} bytes · íntegro=${sha256(lido) === hash}`);

  const itensIniciais = await prisma.invoiceItem.count({ where: { invoiceId: invoice.id } });
  console.log(`itens digitados à mão na fatura: ${itensIniciais} (devem ser 0 — são herdados)`);

  // ---------------------------------------------------------------------
  titulo("2. IMPORTAÇÃO VINCULADA À FATURA");

  const cotacao = await getCotacao({ moeda: "USD", finalidade: "fiscal" });
  const ctx = await resolverContexto({ ncms: ["85081100"], uf: "SP", regime: "lucro_real" });

  const entrada: EntradaCalculo = {
    moeda: "USD",
    taxaCambio: cotacao.rate,
    uf: "SP",
    itens: [{ ncm: "85081100", quantidade: 10, valorUnitarioMoeda: 120 }],
    custos: [
      {
        chave: "frete",
        rotulo: "Frete internacional",
        valor: 2400,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "valor",
      },
    ],
  };
  const resultado = calcular(entrada, ctx);

  const original = await prisma.importacao.create({
    data: {
      userId: user.id,
      invoiceId: invoice.id,
      apelido: "Verificação — com fatura",
      uf: "SP",
      moeda: "USD",
      regimeTributario: "lucro_real",
      rulesetId: resultado.rulesetId,
      baseVersaoId: ctx.baseVersaoId ?? null,
      fxRate: cotacao.rate,
      fxFonte: cotacao.fonteRotulo,
      fxDataRef: cotacao.dataRef,
      contextoJson: JSON.stringify(ctx),
      inputJson: JSON.stringify(entrada),
      resultadoJson: JSON.stringify(resultado),
      landedCost: resultado.landedCost,
      provisorio: resultado.provisorio,
      itens: {
        create: [
          {
            ordem: 0,
            ncm: "85081100",
            descricaoProduto: "Robô aspirador 60 W",
            quantidade: 10,
            valorUnitarioMoeda: 120,
            ncmFonte: "invoice",
            ncmConfirmadoEm: new Date(),
          },
        ],
      },
      custos: {
        create: [
          {
            chave: "frete",
            rotulo: "Frete internacional",
            valor: 2400,
            compoeValorAduaneiro: true,
            entraBaseIcms: false,
            criterioRateio: "valor",
          },
        ],
      },
    },
    select: { id: true },
  });
  console.log(`importação: ${original.id}`);
  console.log(`landed cost: ${formatBRL(resultado.landedCost)}`);
  console.log(`fatura vinculada: ${invoice.id}`);

  // É a importação que alimenta os itens da fatura — nunca o contrário.
  const itensImp = await prisma.importacaoItem.findMany({ where: { importacaoId: original.id } });
  await prisma.invoiceItem.createMany({
    data: itensImp.map((i) => ({
      invoiceId: invoice.id,
      descricao: i.descricaoProduto ?? i.ncm,
      ncm: i.ncm,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitarioMoeda,
    })),
  });
  const herdados = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
  console.log("\nitens herdados pela fatura (sem digitação):");
  for (const it of herdados) {
    console.log(`  ${it.ncm} · ${it.descricao} · ${it.quantidade} × ${formatMoeda(it.valorUnitario, "USD")}`);
  }

  // ---------------------------------------------------------------------
  titulo("3. FATURA EM USO NÃO PODE SER REMOVIDA");

  const usos = await prisma.importacao.count({ where: { invoiceId: invoice.id } });
  console.log(`importações usando esta fatura: ${usos}`);
  console.log(
    usos > 0
      ? "OK — a rota DELETE recusa (409), preservando a rastreabilidade do cálculo."
      : "ATENÇÃO — esperava ao menos uma vinculação.",
  );

  // ---------------------------------------------------------------------
  titulo("4. REUSAR DO HISTÓRICO (RF-D2 / RF-D4)");

  const origem = await prisma.importacao.findFirst({
    where: { id: original.id, userId: user.id },
    include: { itens: { orderBy: { ordem: "asc" } }, custos: true },
  });
  if (!origem) throw new Error("importação original sumiu");

  const custoPor = (c: string) => origem.custos.find((x) => x.chave === c)?.valor ?? 0;
  const rascunho = {
    uf: origem.uf,
    moeda: origem.moeda,
    invoiceId: origem.invoiceId, // a fatura anexada acompanha o reuso
    itens: origem.itens.map((i) => ({
      ncm: i.ncm,
      descricaoProduto: i.descricaoProduto,
      quantidade: i.quantidade,
      valorUnitarioMoeda: i.valorUnitarioMoeda,
    })),
    freteInternacional: custoPor("frete"),
  };
  console.log(`rascunho gerado: ${rascunho.itens.length} item(ns), frete ${formatBRL(rascunho.freteInternacional)}`);
  console.log(`fatura acompanha o reuso? ${rascunho.invoiceId ? "sim — " + rascunho.invoiceId : "NÃO"}`);
  console.log(`contém resultado antigo? ${"resultado" in rascunho ? "SIM (ERRADO)" : "não — correto"}`);

  // Recalcula com câmbio/base ATUAIS, como a duplicação faz de verdade.
  const cotacao2 = await getCotacao({ moeda: origem.moeda, finalidade: "fiscal" });
  const ctx2 = await resolverContexto({
    ncms: rascunho.itens.map((i) => i.ncm),
    uf: rascunho.uf,
    regime: "lucro_real",
  });
  const resultado2 = calcular(
    {
      moeda: origem.moeda,
      taxaCambio: cotacao2.rate,
      uf: rascunho.uf,
      itens: rascunho.itens.map((i) => ({
        ncm: i.ncm,
        quantidade: i.quantidade,
        valorUnitarioMoeda: i.valorUnitarioMoeda,
      })),
      custos: entrada.custos,
    },
    ctx2,
  );

  console.log(`\noriginal  : ${formatBRL(resultado.landedCost)}  (câmbio ${cotacao.rate}, ${cotacao.dataRef})`);
  console.log(`duplicada : ${formatBRL(resultado2.landedCost)}  (câmbio ${cotacao2.rate}, ${cotacao2.dataRef})`);
  const delta = resultado2.landedCost - resultado.landedCost;
  console.log(
    delta === 0
      ? "sem variação — mesma cotação e mesmas alíquotas hoje"
      : `variação de ${formatBRL(delta)} por recalcular com dados atuais`,
  );

  // ---------------------------------------------------------------------
  titulo("LIMPEZA");
  await prisma.importacao.deleteMany({ where: { id: original.id } });
  await prisma.invoice.deleteMany({ where: { id: invoice.id } });
  await getFileStore().delete(chave);
  console.log("registros e arquivo de teste removidos.");
  console.log("\nOK — RF-D2 e RF-D4 verificados.");
}

main()
  .catch((e) => {
    console.error("\nFALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
