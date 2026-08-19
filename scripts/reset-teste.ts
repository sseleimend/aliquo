/**
 * Zera os dados de aplicação e prepara uma conta Pro para teste manual.
 *
 * NÃO apaga a base oficial (nomenclatura, TEC/TIPI, índice FTS5, alíquotas de
 * ICMS): é dado de referência, não do usuário, e reimportá-lo levaria minutos
 * sem mudar nada no teste. Se quiser zerar também, rode `npm run base:import`.
 *
 * Uso: npx tsx scripts/reset-teste.ts
 */

import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "teste@aliquo.com";
const SENHA = "teste-fase2";

async function main() {
  console.log("== Limpeza dos dados de aplicação ==");

  // Ordem importa: filhos antes dos pais.
  const apagados = {
    invoiceItem: (await prisma.invoiceItem.deleteMany({})).count,
    importacaoItem: (await prisma.importacaoItem.deleteMany({})).count,
    importacaoCusto: (await prisma.importacaoCusto.deleteMany({})).count,
    importacao: (await prisma.importacao.deleteMany({})).count,
    invoice: (await prisma.invoice.deleteMany({})).count,
    eventoUso: (await prisma.eventoUso.deleteMany({})).count,
    usoMensal: (await prisma.usoMensal.deleteMany({})).count,
    assinatura: (await prisma.assinatura.deleteMany({})).count,
    despachante: (await prisma.despachante.deleteMany({})).count,
    custoRecorrente: (await prisma.custoRecorrente.deleteMany({})).count,
    auditLog: (await prisma.auditLog.deleteMany({})).count,
    empresa: (await prisma.empresa.deleteMany({})).count,
    ncmFeedback: (await prisma.ncmFeedback.deleteMany({})).count,
    fxCotacao: (await prisma.fxCotacao.deleteMany({})).count,
    user: (await prisma.user.deleteMany({})).count,
  };
  for (const [k, v] of Object.entries(apagados)) {
    if (v > 0) console.log(`  ${k}: ${v} registro(s)`);
  }

  // Arquivos de fatura enviados.
  await rm(path.resolve(process.cwd(), "var", "uploads"), { recursive: true, force: true });
  console.log("  var/uploads/ removido");

  console.log("\n== Base oficial preservada ==");
  const base = await prisma.baseVersao.findFirst({ where: { tipo: "nomenclatura", ativa: true } });
  console.log(`  nomenclatura: ${await prisma.ncmNomenclatura.count()} registros — ${base?.ato}`);
  console.log(`  alíquotas   : ${await prisma.ncmAliquota.count()} códigos`);
  console.log(`  ICMS por UF : ${await prisma.aliquotaUf.count()} UFs`);

  console.log("\n== Conta de teste ==");
  const planoPro = await prisma.plano.findUnique({ where: { codigo: "pro" } });
  if (!planoPro) throw new Error("Plano 'pro' não existe — rode `npm run db:seed`.");

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Conta de Teste",
      passwordHash: await bcrypt.hash(SENHA, 10),
      aceiteTermosEm: new Date(),
    },
  });

  await prisma.assinatura.create({
    data: { userId: user.id, planoId: planoPro.id, status: "ativa" },
  });

  await prisma.empresa.create({
    data: {
      userId: user.id,
      nome: "Importadora Teste Ltda",
      regimeTributario: "lucro_real",
      ufPadrao: "SP",
      padrao: true,
    },
  });

  // Cadastros auxiliares, para testar os atalhos do passo de custos.
  await prisma.despachante.createMany({
    data: [
      { userId: user.id, nome: "Despachante Santos & Cia", honorarios: 850 },
      { userId: user.id, nome: "ComexFast Assessoria", honorarios: 1200 },
    ],
  });
  await prisma.custoRecorrente.createMany({
    data: [
      { userId: user.id, tipo: "siscomex", descricao: "Taxa Siscomex (DI padrão)", valor: 214.5 },
      { userId: user.id, tipo: "thc", descricao: "THC porto de Santos", valor: 1150 },
    ],
  });

  const limites = JSON.parse(planoPro.limitesJson);
  console.log(`  usuário : ${EMAIL}`);
  console.log(`  id      : ${user.id}`);
  console.log(`  plano   : ${planoPro.codigo} (${planoPro.nome})`);
  console.log(`  limites : ${limites.simulacoesMes} simulações/mês, ${limites.itensPorImportacao} itens, upload de fatura: ${limites.invoiceUpload}`);
  console.log(`\n  importações: ${await prisma.importacao.count()}  ·  faturas: ${await prisma.invoice.count()}`);
  console.log("\nOK — base limpa, conta Pro pronta.");
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
