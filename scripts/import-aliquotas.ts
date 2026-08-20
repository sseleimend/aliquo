/**
 * Importa as alíquotas oficiais de II (TEC) e IPI (TIPI) — RF-B1, RNF-1.
 *
 * São duas publicações independentes, com atos e vigências próprios:
 *
 *   II  -> TEC, Anexo I (tarifa comum do Mercosul), SOBREPOSTO pelo
 *          Anexo II ("Diferentes da TEC"), que é onde o Brasil diverge.
 *          Aplicar só o Anexo I dá a alíquota errada para ~9,4 mil códigos.
 *   IPI -> TIPI da Receita Federal. Distingue "NT" (não-tributado) de 0%,
 *          que são fatos fiscais diferentes e não podem ser confundidos.
 *
 * Ao final o script relata a COBERTURA: quantos códigos da nomenclatura
 * ficaram sem II ou sem IPI. Esses códigos não são calculáveis — o motor
 * bloqueia em vez de inventar uma alíquota padrão (foi esse "padrão" que
 * produziu os números fictícios da Fase 1).
 *
 * Uso:
 *   npx tsx scripts/import-aliquotas.ts [--download] [--offline] [--sem-ativar]
 */

import ExcelJS from "exceljs";
import "./lib/env";
import { criarPrismaClient } from "../src/lib/db";
import { apenasDigitos, ehNcmCompleta } from "../src/lib/ncm/codigo";
import { FONTES, flags, obterArquivo, parseAliquota, textoCelula } from "./lib/fontes";

const prisma = criarPrismaClient();

interface Registro {
  ii?: number | null;
  ipi?: number | null;
  ipiNT?: boolean;
  origemII?: string;
  marcadorII?: string | null;
  origemIPI?: string;
}

const chave = (codigo: string, ex: string) => `${codigo}|${ex}`;

/** Percorre uma aba e devolve as linhas cujo código é NCM de 8 dígitos. */
function lerAba(
  ws: ExcelJS.Worksheet,
  colCodigo: number,
  colAliquota: number,
  colEx?: number,
): Array<{ codigo: string; ex: string; bruto: string }> {
  const out: Array<{ codigo: string; ex: string; bruto: string }> = [];
  ws.eachRow((row) => {
    const cod = textoCelula(row.getCell(colCodigo).value).trim();
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(cod)) return;
    const digitos = apenasDigitos(cod);
    if (!ehNcmCompleta(digitos)) return;
    out.push({
      codigo: digitos,
      ex: colEx ? textoCelula(row.getCell(colEx).value).trim() : "",
      bruto: textoCelula(row.getCell(colAliquota).value).trim(),
    });
  });
  return out;
}

async function main() {
  const opts = flags();
  console.log("== Importação de alíquotas (TEC + TIPI) ==");

  // ---------------- TEC (Imposto de Importação) ----------------
  const tec = await obterArquivo("tec", opts);
  const wbTec = new ExcelJS.Workbook();
  await wbTec.xlsx.readFile(tec.caminho);

  const versaoTec = await prisma.baseVersao.create({
    data: {
      tipo: "tec",
      ato: "Resolução Gecex nº 272/2021 (Anexos I e II)",
      vigenteEm: "Anexos I a X — atualização publicada em 03/08/2026",
      fonteUrl: tec.url,
      hashArquivo: tec.hash,
      ativa: false,
    },
  });

  const registros = new Map<string, Registro>();

  const abaI = wbTec.getWorksheet("Anexo I - TEC");
  if (!abaI) throw new Error('Aba "Anexo I - TEC" não encontrada no arquivo da TEC.');
  for (const l of lerAba(abaI, 1, 3)) {
    const a = parseAliquota(l.bruto);
    registros.set(chave(l.codigo, l.ex), {
      ii: a.valor,
      origemII: "TEC Anexo I",
      marcadorII: a.marcador,
    });
  }
  const totalAnexoI = registros.size;

  // O Anexo II sobrepõe o Anexo I: é a alíquota que o Brasil realmente aplica.
  let sobrepostos = 0;
  const abaII = wbTec.getWorksheet("Anexo II - Diferentes da TEC");
  if (abaII) {
    for (const l of lerAba(abaII, 1, 3)) {
      const a = parseAliquota(l.bruto);
      const k = chave(l.codigo, l.ex);
      const anterior = registros.get(k);
      if (anterior && anterior.ii !== a.valor) sobrepostos++;
      registros.set(k, {
        ...anterior,
        ii: a.valor,
        origemII: "TEC Anexo II",
        marcadorII: a.marcador,
      });
    }
  }
  console.log(`  TEC: ${totalAnexoI} códigos no Anexo I, ${sobrepostos} sobrepostos pelo Anexo II`);

  // ---------------- TIPI (IPI) ----------------
  const tipi = await obterArquivo("tipi", opts);
  const wbTipi = new ExcelJS.Workbook();
  await wbTipi.xlsx.readFile(tipi.caminho);

  const versaoTipi = await prisma.baseVersao.create({
    data: {
      tipo: "tipi",
      ato: "TIPI — Decreto 11.158/2022 e atualizações",
      vigenteEm: "Tabela completa publicada pela Receita Federal",
      fonteUrl: tipi.url,
      hashArquivo: tipi.hash,
      ativa: false,
    },
  });

  const abaTipi = wbTipi.getWorksheet("Tabela Completa");
  if (!abaTipi) throw new Error('Aba "Tabela Completa" não encontrada no arquivo da TIPI.');

  let comIpi = 0;
  let nt = 0;
  for (const l of lerAba(abaTipi, 1, 4, 2)) {
    const a = parseAliquota(l.bruto);
    const k = chave(l.codigo, l.ex);
    const anterior = registros.get(k) ?? registros.get(chave(l.codigo, "")) ?? {};
    if (a.naoTributado) nt++;
    else if (a.valor != null) comIpi++;
    registros.set(k, {
      ...anterior,
      ipi: a.valor,
      ipiNT: a.naoTributado,
      origemIPI: "TIPI",
    });
  }
  console.log(`  TIPI: ${comIpi} códigos com alíquota, ${nt} marcados NT (não-tributado)`);

  // ---------------- Grava ----------------
  const linhas = [...registros.entries()].map(([k, r]) => {
    const [codigo, ex] = k.split("|");
    return {
      codigo,
      ex: ex ?? "",
      ii: r.ii ?? null,
      ipi: r.ipi ?? null,
      ipiNT: r.ipiNT ?? false,
      origemII: r.origemII ?? null,
      marcadorII: r.marcadorII ?? null,
      origemIPI: r.origemIPI ?? null,
      iiBaseVersao: r.origemII ? versaoTec.id : null,
      ipiBaseVersao: r.origemIPI ? versaoTipi.id : null,
    };
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.ncmAliquota.deleteMany({});
      const LOTE = 1000;
      for (let i = 0; i < linhas.length; i += LOTE) {
        await tx.ncmAliquota.createMany({ data: linhas.slice(i, i + LOTE) });
      }
      if (opts.ativar) {
        await tx.baseVersao.updateMany({ where: { tipo: "tec" }, data: { ativa: false } });
        await tx.baseVersao.updateMany({ where: { tipo: "tipi" }, data: { ativa: false } });
        await tx.baseVersao.update({ where: { id: versaoTec.id }, data: { ativa: true } });
        await tx.baseVersao.update({ where: { id: versaoTipi.id }, data: { ativa: true } });
      }
      await tx.baseVersao.update({
        where: { id: versaoTec.id },
        data: { totalRegistros: linhas.filter((l) => l.ii != null).length },
      });
      await tx.baseVersao.update({
        where: { id: versaoTipi.id },
        data: { totalRegistros: linhas.filter((l) => l.ipi != null || l.ipiNT).length },
      });
    },
    { timeout: 120_000 },
  );

  // ---------------- Relatório de cobertura ----------------
  // É o número que diz quanto do catálogo é realmente calculável.
  const itens = await prisma.ncmNomenclatura.findMany({
    where: { nivel: "item" },
    select: { codigo: true },
  });
  const gerais = new Map(linhas.filter((l) => l.ex === "").map((l) => [l.codigo, l]));

  let semII = 0;
  let semIPI = 0;
  const exemplosSemII: string[] = [];
  for (const it of itens) {
    const r = gerais.get(it.codigo);
    if (!r || r.ii == null) {
      semII++;
      if (exemplosSemII.length < 5) exemplosSemII.push(it.codigo);
    }
    if (!r || (r.ipi == null && !r.ipiNT)) semIPI++;
  }

  const total = itens.length;
  const pct = (n: number) => `${(((total - n) / total) * 100).toFixed(2)}%`;
  console.log("");
  console.log("  --- COBERTURA sobre a nomenclatura vigente ---");
  console.log(`  itens (NCM de 8 dígitos): ${total}`);
  console.log(`  com II  : ${total - semII} (${pct(semII)})  | sem II  : ${semII}`);
  console.log(`  com IPI : ${total - semIPI} (${pct(semIPI)}) | sem IPI : ${semIPI}`);
  if (exemplosSemII.length) {
    console.log(`  exemplos sem II: ${exemplosSemII.join(", ")}`);
  }
  console.log("  Códigos sem alíquota oficial NÃO são calculados — o motor bloqueia.");
  console.log(`  fontes: ${FONTES.tec.rotulo} · ${FONTES.tipi.rotulo}`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
