/**
 * Reconstrói o índice de busca FTS5 a partir de NcmNomenclatura + NcmSinonimo.
 *
 * "NcmFts" é um índice DERIVADO e descartável — nunca fonte de verdade. Pode
 * ser apagado e reconstruído a qualquer momento em poucos segundos. É por isso
 * que a tabela virtual não ser gerenciada pelo Prisma é aceitável: se um
 * `migrate` futuro derrubá-la, este script a traz de volta.
 *
 * Uso: npm run ncm:index
 */

import "./lib/env";
import { criarPrismaClient } from "../src/lib/db";
import { SINONIMOS } from "./data/sinonimos";
import { normalizarTexto } from "../src/lib/ncm/codigo";

const prisma = criarPrismaClient();

const DDL = `
CREATE VIRTUAL TABLE "NcmFts" USING fts5(
  codigo UNINDEXED,
  nivel UNINDEXED,
  descricao,
  caminho,
  sinonimos,
  tokenize = 'unicode61 remove_diacritics 2'
);`;

async function semearSinonimos() {
  const existentes = await prisma.ncmSinonimo.count({ where: { origem: "curado" } });
  if (existentes === SINONIMOS.length) return existentes;

  await prisma.ncmSinonimo.deleteMany({ where: { origem: "curado" } });
  await prisma.ncmSinonimo.createMany({
    data: SINONIMOS.map((s) => ({
      termo: normalizarTexto(s.termo),
      codigo: s.codigo,
      peso: 1,
      origem: "curado",
    })),
  });
  return SINONIMOS.length;
}

async function main() {
  console.log("== Reconstrução do índice FTS5 ==");

  const nSin = await semearSinonimos();
  console.log(`  sinônimos curados: ${nSin}`);

  const linhas = await prisma.ncmNomenclatura.findMany({
    select: { codigo: true, nivel: true, descricao: true, caminho: true },
  });
  if (linhas.length === 0) {
    throw new Error("Nomenclatura vazia — rode `npm run base:nomenclatura` antes de indexar.");
  }

  const sinonimos = await prisma.ncmSinonimo.findMany({ select: { termo: true, codigo: true } });
  // Sinônimo cadastrado numa posição vale para todos os itens abaixo dela,
  // senão "notebook" acharia a posição 84.71 mas nenhum item de 8 dígitos.
  const porPrefixo = new Map<string, string[]>();
  for (const s of sinonimos) {
    const arr = porPrefixo.get(s.codigo) ?? [];
    arr.push(s.termo);
    porPrefixo.set(s.codigo, arr);
  }
  function sinonimosDe(codigo: string): string {
    const termos: string[] = [];
    for (const [prefixo, lista] of porPrefixo) {
      if (codigo.startsWith(prefixo)) termos.push(...lista);
    }
    return [...new Set(termos)].join(" ");
  }

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "NcmFts"`);
  await prisma.$executeRawUnsafe(DDL);

  const LOTE = 400;
  let inseridos = 0;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const bloco = linhas.slice(i, i + LOTE);
    const placeholders = bloco.map(() => "(?,?,?,?,?)").join(",");
    const valores: string[] = [];
    for (const l of bloco) {
      valores.push(l.codigo, l.nivel, l.descricao, l.caminho, sinonimosDe(l.codigo));
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "NcmFts"(codigo,nivel,descricao,caminho,sinonimos) VALUES ${placeholders}`,
      ...valores,
    );
    inseridos += bloco.length;
  }

  const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*) AS n FROM "NcmFts"`,
  );
  console.log(`  indexados: ${inseridos} (conferência na tabela: ${n})`);
  console.log("  ok.");
}

main()
  .catch((e) => {
    console.error("FALHOU:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
