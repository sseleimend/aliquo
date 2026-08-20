/**
 * Verificação ponta a ponta do caso que motivou a Fase 2.
 *
 * Reproduz o mesmo pedido que a Fase 1 errou — "robô aspirador de pó" — e
 * percorre a pilha inteira: descoberta de NCM na base oficial, resolução de
 * contexto tributário, cálculo, persistência e geração do PDF.
 *
 * Uso: npx tsx scripts/verificar-e2e.ts
 */

import { writeFile } from "node:fs/promises";
import "./lib/env";
import { prisma } from "../src/lib/db";
import { descobrirNcm } from "../src/lib/ncm/classifier";
import { getCotacao } from "../src/lib/fx";
import { resolverContexto } from "../src/lib/tax/contexto";
import { calcular } from "../src/lib/tax/engine";
import { gerarPdf } from "../src/lib/export/pdf";
import { formatBRL, formatPct } from "../src/lib/format";
import type { EntradaCalculo } from "../src/lib/tax/types";

const DESCRICAO = "robô aspirador de pó, motor de 60 W, reservatório de 0,6 litro";

function titulo(s: string) {
  console.log(`\n${"=".repeat(64)}\n${s}\n${"=".repeat(64)}`);
}

async function main() {
  titulo("1. DESCOBERTA DE NCM (RF-A1/A2)");
  console.log(`Descrição: "${DESCRICAO}"`);

  const r = await descobrirNcm({ descricao: DESCRICAO });
  console.log(`\nIA utilizada: ${r.meta.usouIA} | candidatos recuperados: ${r.meta.recuperados}`);
  if (r.reformulacao) console.log(`Reformulação: ${r.reformulacao}`);
  for (const a of r.avisos) console.log(`AVISO: ${a}`);

  if (r.proximaPergunta) {
    console.log(`\nPergunta de desambiguação: ${r.proximaPergunta.texto}`);
    for (const o of r.proximaPergunta.opcoes) console.log(`   [${o.i}] ${o.rotulo}`);
  }

  console.log("\nCandidatos (todos vindos da base oficial):");
  for (const c of (r.candidatos ?? []).slice(0, 4)) {
    console.log(`  ${c.ncm}  conf=${c.confianca}`);
    console.log(`     ${c.caminho.slice(0, 110)}`);
  }

  const escolhido = r.candidatos?.[0];
  if (!escolhido) throw new Error("Nenhum candidato — verificação interrompida.");

  titulo("2. CÂMBIO (RF-C1)");
  const cotacao = await getCotacao({ moeda: "USD", finalidade: "fiscal" });
  console.log(`${cotacao.fonteRotulo}`);
  console.log(`taxa=${cotacao.rate}  dataRef=${cotacao.dataRef}  obsoleta=${cotacao.stale}`);

  titulo("3. CONTEXTO TRIBUTÁRIO (RNF-1/RNF-6)");
  const ctx = await resolverContexto({
    ncms: [escolhido.codigo],
    uf: "SP",
    regime: "lucro_real",
    fx: {
      moeda: cotacao.moeda,
      rate: cotacao.rate,
      fonte: cotacao.fonteRotulo,
      asOf: cotacao.asOf,
      dataRef: cotacao.dataRef,
      stale: cotacao.stale,
    },
  });
  const aliq = ctx.porNcm[escolhido.codigo];
  console.log(`Base: ${ctx.baseAto} (${ctx.baseVigenteEm})`);
  console.log(`Regras: ${ctx.rulesetRotulo} [${ctx.rulesetId}]`);
  console.log(
    `II  = ${aliq.ii.conhecida ? formatPct(aliq.ii.valor) + " · " + aliq.ii.fonte : "DESCONHECIDA"}`,
  );
  console.log(
    `IPI = ${aliq.ipi.conhecida ? formatPct(aliq.ipi.valor) + " · " + aliq.ipi.fonte : "DESCONHECIDA"}`,
  );

  titulo("4. CÁLCULO (RF-B1/RF-C3)");
  const entrada: EntradaCalculo = {
    moeda: cotacao.moeda,
    taxaCambio: cotacao.rate,
    uf: "SP",
    itens: [
      {
        ncm: escolhido.codigo,
        descricaoProduto: DESCRICAO,
        quantidade: 10,
        valorUnitarioMoeda: 120,
      },
    ],
    custos: [
      {
        chave: "frete",
        rotulo: "Frete internacional",
        valor: 2400,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "valor",
      },
      {
        chave: "seguro",
        rotulo: "Seguro internacional",
        valor: 90,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "valor",
      },
      {
        chave: "siscomex",
        rotulo: "Taxa Siscomex",
        valor: 214.5,
        compoeValorAduaneiro: false,
        entraBaseIcms: true,
        criterioRateio: "valor",
      },
    ],
  };

  const resultado = calcular(entrada, ctx);
  const item = resultado.itens[0];
  console.log(`Valor aduaneiro: ${formatBRL(item.valorAduaneiro)}`);
  for (const t of item.tributos) {
    console.log(
      `  ${t.rotulo.padEnd(28)} ${formatPct(t.aliquota).padStart(7)}  ` +
        `base ${formatBRL(t.base).padStart(14)}  ${formatBRL(t.valor).padStart(13)}`,
    );
    console.log(`      fonte: ${t.fonteAliquota} · ${t.fonteLegal}`);
  }
  console.log(`\nTotal de tributos : ${formatBRL(resultado.totalTributos)}`);
  console.log(`Total de custos   : ${formatBRL(resultado.totalCustos)}`);
  console.log(`LANDED COST       : ${formatBRL(resultado.landedCost)}`);
  console.log(`Custo efetivo     : ${formatBRL(resultado.landedCostEfetivo)}`);
  console.log(`Provisório        : ${resultado.provisorio}`);
  for (const a of resultado.avisos) console.log(`AVISO: ${a}`);

  titulo("5. PERSISTÊNCIA (RF-D3)");
  // E2E_EMAIL permite rodar contra um ambiente sem a conta demo — um banco de
  // produção recém-criado, por exemplo, onde criar demo@aliquo.com com senha
  // conhecida seria abrir uma porta.
  const email = process.env.E2E_EMAIL || "demo@aliquo.com";
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(
      `Usuário ${email} não encontrado. Rode "npm run db:seed" ou aponte E2E_EMAIL para uma conta existente.`,
    );
  }

  const salvo = await prisma.importacao.create({
    data: {
      userId: user.id,
      apelido: "Verificação E2E — robô aspirador",
      status: resultado.provisorio ? "bloqueada" : "simulada",
      uf: "SP",
      moeda: cotacao.moeda,
      regimeTributario: "lucro_real",
      rulesetId: resultado.rulesetId,
      baseVersaoId: ctx.baseVersaoId ?? null,
      fxRate: cotacao.rate,
      fxFonte: cotacao.fonteRotulo,
      fxAsOf: new Date(cotacao.asOf),
      fxDataRef: cotacao.dataRef,
      fxStale: cotacao.stale,
      contextoJson: JSON.stringify(ctx),
      inputJson: JSON.stringify(entrada),
      resultadoJson: JSON.stringify(resultado),
      landedCost: resultado.landedCost,
      landedCostEfetivo: resultado.landedCostEfetivo,
      provisorio: resultado.provisorio,
      itens: {
        create: [
          {
            ordem: 0,
            ncm: escolhido.codigo,
            ncmDescricaoOficial: item.descricaoOficial,
            ncmCaminhoOficial: item.caminhoOficial,
            descricaoProduto: DESCRICAO,
            quantidade: 10,
            valorUnitarioMoeda: 120,
            ncmFonte: "ia_confirmada",
            ncmConfianca: escolhido.confianca,
            ncmConfirmadoEm: new Date(),
            resultadoJson: JSON.stringify(item),
            landedCost: item.landedCost,
          },
        ],
      },
    },
    select: { id: true },
  });
  console.log(`Importação salva: ${salvo.id}`);

  titulo("6. PDF (RF-C3, RNF-1)");
  const pdf = await gerarPdf({
    resultado,
    apelido: "Verificação E2E",
    createdAt: new Date(),
    importacaoId: salvo.id,
  });
  const caminho = "var/verificacao-e2e.pdf";
  await writeFile(caminho, pdf);
  console.log(`PDF gerado: ${caminho} (${(pdf.length / 1024).toFixed(1)} KB)`);

  titulo("RESUMO");
  const ok = escolhido.codigo === "85081100" && !resultado.provisorio;
  console.log(`NCM obtida        : ${escolhido.ncm} ${escolhido.codigo === "85081100" ? "(correta)" : "(INESPERADA)"}`);
  console.log(`Alíquotas oficiais: ${aliq.ii.conhecida && aliq.ipi.conhecida ? "sim" : "NÃO"}`);
  console.log(`Cálculo confiável : ${!resultado.provisorio ? "sim" : "não (provisório)"}`);
  console.log(`\n${ok ? "OK — pipeline completo funcionando." : "ATENÇÃO — revisar acima."}`);
}

main()
  .catch((e) => {
    console.error("\nFALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
