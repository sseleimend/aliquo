/**
 * Produz o arquivo SQLite que vai virar o banco de produção no Turso.
 *
 * Parte do `prisma/dev.db` porque ele já contém o caro: schema migrado, base
 * oficial importada (nomenclatura, TEC/TIPI), alíquotas de ICMS por UF e o
 * índice FTS5 construído. Reimportar tudo do zero levaria minutos e chegaria
 * ao mesmo lugar.
 *
 * O que sai: TODO dado de usuário. Conta demo, simulações, faturas e anexos
 * são de desenvolvimento e não têm por que nascer em produção.
 *
 * Uso: npx tsx scripts/preparar-producao.ts
 * Depois: turso db create aliquo --from-file var/producao.db
 */

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import "./lib/env";
import { PrismaClient } from "@prisma/client";

const ORIGEM = path.resolve(process.cwd(), "prisma", "dev.db");
const DESTINO = path.resolve(process.cwd(), "var", "producao.db");

/** Prisma exige URL com barras normais, inclusive no Windows. */
function urlDeArquivo(absoluto: string): string {
  return `file:${absoluto.replace(/\\/g, "/")}`;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  if (!existsSync(ORIGEM)) {
    throw new Error(
      `${ORIGEM} não existe. Rode \`npx prisma migrate deploy\`, ` +
        "`npm run base:import` e `npm run db:seed` antes.",
    );
  }

  await mkdir(path.dirname(DESTINO), { recursive: true });
  // Um -wal remanescente reintroduziria dados que acabamos de apagar.
  for (const sufixo of ["", "-journal", "-wal", "-shm"]) {
    await rm(`${DESTINO}${sufixo}`, { force: true });
  }
  await copyFile(ORIGEM, DESTINO);
  console.log(`Cópia: ${DESTINO} (${mb((await stat(DESTINO)).size)})`);

  const prisma = new PrismaClient({ datasourceUrl: urlDeArquivo(DESTINO) });

  try {
    console.log("\n== Removendo dados de desenvolvimento ==");
    // Ordem importa: filhos antes dos pais.
    const apagados = {
      invoiceItem: (await prisma.invoiceItem.deleteMany({})).count,
      importacaoItem: (await prisma.importacaoItem.deleteMany({})).count,
      importacaoCusto: (await prisma.importacaoCusto.deleteMany({})).count,
      importacao: (await prisma.importacao.deleteMany({})).count,
      invoice: (await prisma.invoice.deleteMany({})).count,
      arquivoBlob: (await prisma.arquivoBlob.deleteMany({})).count,
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
    for (const [tabela, n] of Object.entries(apagados)) {
      if (n > 0) console.log(`  ${tabela}: ${n}`);
    }

    await prisma.$executeRawUnsafe("VACUUM");

    console.log("\n== Conferência do que vai para produção ==");
    const nomenclatura = await prisma.ncmNomenclatura.count();
    const aliquotas = await prisma.ncmAliquota.count();
    const ufs = await prisma.aliquotaUf.count();
    const planos = await prisma.plano.count();
    const [{ n: fts }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      'SELECT count(*) AS n FROM "NcmFts"',
    );
    const usuarios = await prisma.user.count();

    console.log(`  nomenclatura : ${nomenclatura}`);
    console.log(`  alíquotas NCM: ${aliquotas}`);
    console.log(`  ICMS por UF  : ${ufs}`);
    console.log(`  planos       : ${planos}`);
    console.log(`  índice FTS5  : ${Number(fts)}`);
    console.log(`  usuários     : ${usuarios}`);

    // Sem qualquer um destes, a aplicação sobe e falha na primeira consulta.
    const faltando: string[] = [];
    if (nomenclatura === 0) faltando.push("nomenclatura (npm run base:nomenclatura)");
    if (aliquotas === 0) faltando.push("alíquotas II/IPI (npm run base:aliquotas)");
    if (Number(fts) === 0) faltando.push("índice FTS5 (npm run ncm:index)");
    if (planos === 0) faltando.push("planos (npm run db:seed)");
    if (ufs === 0) faltando.push("ICMS por UF (npm run db:seed)");
    if (faltando.length > 0) {
      throw new Error(`Arquivo incompleto — falta:\n  - ${faltando.join("\n  - ")}`);
    }
    if (usuarios > 0) throw new Error("Ainda há usuários no arquivo — limpeza falhou.");

    console.log(`\nPronto: ${DESTINO} (${mb((await stat(DESTINO)).size)})`);
    console.log("Publique com:\n  turso db create aliquo --from-file var/producao.db");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
