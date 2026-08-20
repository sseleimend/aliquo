/**
 * Carrega a tabela de ICMS por UF a partir de um CSV.
 *
 * Existe porque não há tabela oficial consolidada dos 27 estados: cada um fixa
 * a sua no próprio RICMS, e quem quiser o dado tem que compilar as 27 fontes.
 * Esse trabalho é de pesquisa, não de código — então o código só precisa
 * aceitar o resultado dele sem exigir deploy.
 *
 * As linhas são VERSIONADAS por vigência: carregar uma tabela nova não apaga
 * a antiga, ela fecha a anterior. Simulação gravada continua reproduzível com
 * a alíquota que estava valendo no dia — que é a promessa da Fase 2.
 *
 * Formato (com cabeçalho, separador `,` ou `;`):
 *
 *   uf,aliquota,fecp,fecpPadrao,vigenciaIni,fonte
 *   RJ,20,2,sim,2026-01-01,SEFAZ-RJ — Lei 2.657/1996 art. 14
 *   SC,17,0,nao,2026-01-01,RICMS-SC Decreto 2.870/2001 art. 26
 *
 *   aliquota / fecp  em pontos percentuais (20 = 20%)
 *   fecpPadrao       sim|nao — se o adicional incide de forma geral no estado
 *   vigenciaIni      AAAA-MM-DD (opcional; padrão = 1º de janeiro do ano)
 *   fonte            texto livre; é o que aparece no resultado e no PDF
 *
 * Uso: npx tsx scripts/importar-aliquotas-uf.ts <arquivo.csv> [--dry-run]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { UF_LIST } from "../src/lib/tax/uf";

const prisma = new PrismaClient();

interface Linha {
  uf: string;
  aliquota: number;
  fecp: number;
  fecpPadrao: boolean;
  vigenciaIni: Date;
  fonte: string;
}

function separador(cabecalho: string): string {
  return cabecalho.includes(";") ? ";" : ",";
}

/** Divide respeitando aspas — fonte legal costuma trazer vírgula dentro. */
function dividir(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else entreAspas = !entreAspas;
    } else if (c === sep && !entreAspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function percentual(bruto: string, onde: string): number {
  const n = Number(bruto.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) throw new Error(`${onde}: "${bruto}" não é um número válido`);
  // 0,20 e 20 significam a mesma coisa para quem digita; aceitamos os dois,
  // mas acima de 1 só pode ser ponto percentual.
  const fracao = n > 1 ? n / 100 : n;
  if (fracao > 0.35) throw new Error(`${onde}: ${n} é alto demais para uma alíquota de ICMS`);
  return fracao;
}

function booleano(bruto: string): boolean {
  return /^(sim|s|true|1|x)$/i.test(bruto.trim());
}

function parsear(texto: string): Linha[] {
  const linhas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"));
  if (linhas.length < 2) throw new Error("CSV sem linhas de dados.");

  const sep = separador(linhas[0]);
  const cab = dividir(linhas[0], sep).map((c) => c.toLowerCase());
  const col = (nome: string) => cab.indexOf(nome);

  const iUf = col("uf");
  const iAliq = col("aliquota");
  if (iUf < 0 || iAliq < 0) {
    throw new Error(`Cabeçalho precisa ter ao menos "uf" e "aliquota". Veio: ${cab.join(", ")}`);
  }
  const iFecp = col("fecp");
  const iPadrao = col("fecppadrao");
  const iVig = col("vigenciaini");
  const iFonte = col("fonte");

  const anoPadrao = new Date().getUTCFullYear();
  const vistos = new Set<string>();

  return linhas.slice(1).map((bruta, n) => {
    const c = dividir(bruta, sep);
    const onde = `linha ${n + 2}`;
    const uf = (c[iUf] ?? "").toUpperCase();

    if (!(UF_LIST as readonly string[]).includes(uf)) {
      throw new Error(`${onde}: "${uf}" não é uma UF válida`);
    }
    if (vistos.has(uf)) throw new Error(`${onde}: ${uf} aparece duas vezes`);
    vistos.add(uf);

    const vigTexto = (iVig >= 0 ? c[iVig] : "") || `${anoPadrao}-01-01`;
    const vigenciaIni = new Date(`${vigTexto}T00:00:00.000Z`);
    if (Number.isNaN(vigenciaIni.getTime())) {
      throw new Error(`${onde}: data "${vigTexto}" inválida (use AAAA-MM-DD)`);
    }

    const fonte = (iFonte >= 0 ? c[iFonte] : "") || "";
    if (!fonte) throw new Error(`${onde}: informe a fonte — é ela que justifica o número`);
    if (/estimativa/i.test(fonte)) {
      throw new Error(`${onde}: "estimativa" na fonte anula o objetivo desta carga`);
    }

    return {
      uf,
      aliquota: percentual(c[iAliq] ?? "", `${onde} (aliquota)`),
      fecp: iFecp >= 0 && c[iFecp] ? percentual(c[iFecp], `${onde} (fecp)`) : 0,
      fecpPadrao: iPadrao >= 0 ? booleano(c[iPadrao] ?? "") : false,
      vigenciaIni,
      fonte,
    };
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const arquivo = argv.find((a) => !a.startsWith("--"));
  const simular = argv.includes("--dry-run");

  if (!arquivo) {
    console.error("Uso: npx tsx scripts/importar-aliquotas-uf.ts <arquivo.csv> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const texto = await readFile(path.resolve(arquivo), "utf8");
  const linhas = parsear(texto);

  console.log(`${linhas.length} UF(s) no arquivo${simular ? "  [dry-run]" : ""}\n`);
  const faltando = UF_LIST.filter((u) => !linhas.some((l) => l.uf === u));

  for (const l of linhas) {
    const total = l.aliquota + (l.fecpPadrao ? l.fecp : 0);
    console.log(
      `  ${l.uf}  ${(l.aliquota * 100).toFixed(2).padStart(6)}%` +
        (l.fecp > 0 ? ` + ${(l.fecp * 100).toFixed(2)}% FECP${l.fecpPadrao ? "" : " (sob demanda)"}` : "") +
        `  = ${(total * 100).toFixed(2)}%  · ${l.fonte}`,
    );
  }

  if (!simular) {
    for (const l of linhas) {
      // Fecha a vigência anterior em vez de sobrescrever: simulação antiga
      // continua reproduzível com a alíquota que valia no dia dela.
      await prisma.aliquotaUf.updateMany({
        where: { uf: l.uf, vigenciaFim: null, vigenciaIni: { lt: l.vigenciaIni } },
        data: { vigenciaFim: new Date(l.vigenciaIni.getTime() - 86_400_000) },
      });
      await prisma.aliquotaUf.upsert({
        where: { uf_vigenciaIni: { uf: l.uf, vigenciaIni: l.vigenciaIni } },
        update: {
          aliquota: l.aliquota,
          fecp: l.fecp,
          fecpPadrao: l.fecpPadrao,
          fonte: l.fonte,
          vigenciaFim: null,
        },
        create: {
          uf: l.uf,
          aliquota: l.aliquota,
          fecp: l.fecp,
          fecpPadrao: l.fecpPadrao,
          fonte: l.fonte,
          vigenciaIni: l.vigenciaIni,
        },
      });
    }
    console.log(`\ngravadas ${linhas.length} UF(s).`);
  }

  if (faltando.length > 0) {
    console.log(
      `\nsem dado oficial (${faltando.length}): ${faltando.join(", ")}` +
        `\n  -> essas continuam caindo na estimativa interna, sinalizada na tela.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
