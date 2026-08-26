/**
 * Confere que o banco em uso aguenta o que a aplicação exige.
 *
 * Existe por causa do deploy: o Turso é um fork do SQLite, e a aposta desta
 * arquitetura é que o fork mantém FTS5 com `bm25()` e aceita BLOB. Testar isso
 * pela CLI do Turso provaria menos — o que precisa funcionar é o caminho do
 * Prisma com o driver adapter, que é o que este script percorre.
 *
 * Local:      npx tsx scripts/verificar-banco.ts
 * Produção:   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/verificar-banco.ts
 */

import "./lib/env";
import { bancoRemoto, criarPrismaClient } from "../src/lib/db";
import { dbFileStore } from "../src/lib/storage";

const prisma = criarPrismaClient();

const falhas: string[] = [];

function conferir(nome: string, ok: boolean, detalhe: string) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}: ${detalhe}`);
  if (!ok) falhas.push(nome);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "(nenhuma)";
  console.log(`Banco: ${bancoRemoto() ? "remoto (Turso)" : "arquivo local"}`);
  console.log(`URL:   ${url.replace(/authToken=[^&]+/i, "authToken=***")}\n`);

  console.log("== Base oficial ==");
  const nomenclatura = await prisma.ncmNomenclatura.count();
  const aliquotas = await prisma.ncmAliquota.count();
  const ufs = await prisma.aliquotaUf.count();
  const planos = await prisma.plano.count();
  conferir("nomenclatura", nomenclatura > 10_000, `${nomenclatura} registros`);
  conferir("alíquotas II/IPI", aliquotas > 10_000, `${aliquotas} códigos`);
  conferir("ICMS por UF", ufs >= 27, `${ufs} UFs`);
  conferir("planos", planos > 0, `${planos} planos`);

  console.log("\n== Índice FTS5 (o que sustenta a escolha do Turso) ==");
  try {
    const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      'SELECT count(*) AS n FROM "NcmFts"',
    );
    conferir("tabela virtual", Number(n) > 0, `${Number(n)} linhas indexadas`);

    // MATCH + bm25 é exatamente a consulta de src/lib/ncm/retrieval.ts.
    const achados = await prisma.$queryRawUnsafe<Array<{ codigo: string; rank: number }>>(
      `SELECT codigo, bm25("NcmFts", 0, 0, 10.0, 3.0, 25.0) AS rank
         FROM "NcmFts"
        WHERE "NcmFts" MATCH ?
        ORDER BY rank
        LIMIT 3`,
      '"aspirador"*',
    );
    conferir(
      "MATCH + bm25",
      achados.length > 0,
      achados.map((a) => `${a.codigo} (${a.rank.toFixed(2)})`).join(", ") || "nenhum resultado",
    );
  } catch (e) {
    conferir("FTS5", false, e instanceof Error ? e.message : String(e));
  }

  console.log("\n== Armazenamento de anexos em BLOB ==");
  const chave = `__verificacao__/${Date.now()}.pdf`;
  const conteudo = Buffer.from("%PDF-1.4 verificação de round-trip\n");
  try {
    await dbFileStore.put(chave, conteudo, "application/pdf");
    const volta = await dbFileStore.get(chave);
    conferir("round-trip", volta.equals(conteudo), `${volta.byteLength} bytes idênticos`);
  } catch (e) {
    conferir("round-trip", false, e instanceof Error ? e.message : String(e));
  } finally {
    await dbFileStore.delete(chave);
  }

  if (falhas.length > 0) {
    console.error(`\n${falhas.length} verificação(ões) falharam: ${falhas.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nTudo certo — o banco aguenta a aplicação.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
