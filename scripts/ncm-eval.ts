/**
 * Mede a qualidade da RECUPERAÇÃO, sem nenhuma IA no caminho.
 *
 * Este é o diagnóstico mais importante do módulo A: separa "o modelo escolheu
 * errado" de "o candidato certo nunca esteve na lista". Se o recall aqui for
 * baixo, nenhuma engenharia de prompt salva — o conserto é na recuperação.
 *
 * Uso: npm run ncm:eval
 */

import { recuperarCandidatos } from "../src/lib/ncm/retrieval";
import { CASOS } from "./data/casos-classificacao";
import "./lib/env";
import { prisma } from "../src/lib/db";

interface Linha {
  descricao: string;
  esperada: string;
  posicaoRank: number | null; // 1-based, null = não recuperada
  itemRank: number | null;
  ncmEsperada?: string;
}

async function main() {
  console.log("== Avaliação de recuperação NCM (sem IA) ==\n");

  const linhas: Linha[] = [];

  for (const caso of CASOS) {
    const { candidatos, posicoes } = await recuperarCandidatos({
      descricao: caso.descricao,
      limite: 30,
    });

    const idxPos = posicoes.findIndex((p) => p.codigo === caso.posicao);
    const idxItemDaPosicao = candidatos.findIndex((c) => c.codigo.startsWith(caso.posicao));
    const idxNcm = caso.ncm ? candidatos.findIndex((c) => c.codigo === caso.ncm) : -1;

    linhas.push({
      descricao: caso.descricao,
      esperada: caso.posicao,
      posicaoRank: idxPos >= 0 ? idxPos + 1 : null,
      itemRank: idxItemDaPosicao >= 0 ? idxItemDaPosicao + 1 : null,
      ncmEsperada: caso.ncm ? (idxNcm >= 0 ? `#${idxNcm + 1}` : "AUSENTE") : undefined,
    });
  }

  const n = linhas.length;
  const contar = (p: (l: Linha) => boolean) => linhas.filter(p).length;

  const posTop1 = contar((l) => l.posicaoRank === 1);
  const posTop4 = contar((l) => l.posicaoRank != null);
  const item10 = contar((l) => l.itemRank != null && l.itemRank <= 10);
  const item30 = contar((l) => l.itemRank != null);

  const falhas = linhas.filter((l) => l.posicaoRank == null);
  const naoTop1 = linhas.filter((l) => l.posicaoRank != null && l.posicaoRank > 1);

  if (falhas.length) {
    console.log("FALHAS DE RECUPERAÇÃO (posição esperada fora do conjunto):");
    for (const f of falhas) console.log(`  ✗ [${f.esperada}] ${f.descricao}`);
    console.log("");
  }
  if (naoTop1.length) {
    console.log("Recuperadas, mas não em 1º lugar:");
    for (const f of naoTop1) console.log(`  ~ [${f.esperada}] #${f.posicaoRank}  ${f.descricao}`);
    console.log("");
  }

  const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
  console.log("--- MÉTRICAS ---");
  console.log(`  casos avaliados          : ${n}`);
  console.log(`  posição correta em 1º    : ${posTop1}/${n}  ${pct(posTop1)}`);
  console.log(`  posição no conjunto      : ${posTop4}/${n}  ${pct(posTop4)}   <- recall que importa`);
  console.log(`  item da posição no top10 : ${item10}/${n}  ${pct(item10)}`);
  console.log(`  item da posição no top30 : ${item30}/${n}  ${pct(item30)}`);

  const comNcm = linhas.filter((l) => l.ncmEsperada);
  if (comNcm.length) {
    console.log("\n  NCM exata (quando a descrição traz os atributos):");
    for (const l of comNcm) console.log(`    ${l.ncmEsperada}  ${l.descricao.slice(0, 60)}`);
  }

  console.log("");
  if (posTop4 / n >= 0.9) console.log("  OK — recall acima de 90%, o gargalo passa a ser o ranqueamento.");
  else console.log("  ATENÇÃO — recall abaixo de 90%: melhorar sinônimos/expansão antes de mexer em prompt.");
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
