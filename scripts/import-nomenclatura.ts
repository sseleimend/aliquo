/**
 * Importa a nomenclatura NCM oficial (RF-A1, RNF-1, RNF-2).
 *
 * O ponto crítico deste script é o campo `caminho`. O texto oficial é
 * CUMULATIVO na árvore do Sistema Harmonizado: a folha 8508.11.00 é apenas
 *
 *     "-- De potência não superior a 1.500 W e cujo volume do reservatório
 *      não exceda 20 l"
 *
 * ...que não diz em lugar nenhum que se trata de um aspirador. Isso só existe
 * subindo até a posição 85.08 ("Aspiradores."). Sem reconstituir essa linhagem
 * não há recuperação possível — e é exatamente por isso que a Fase 1 inventava
 * descrições plausíveis para códigos errados.
 *
 * Uso:
 *   npx tsx scripts/import-nomenclatura.ts [--download] [--offline] [--sem-ativar]
 */

import "./lib/env";
import { criarPrismaClient } from "../src/lib/db";
import {
  apenasDigitos,
  limparHtml,
  limparTravessoes,
  nivelDe,
  prefixosAncestrais,
} from "../src/lib/ncm/codigo";
import { FONTES, flags, obterArquivo } from "./lib/fontes";

const prisma = criarPrismaClient();

interface RegistroOficial {
  Codigo: string;
  Descricao: string;
  Data_Inicio?: string;
  Data_Fim?: string;
}

interface ArquivoOficial {
  Data_Ultima_Atualizacao_NCM: string;
  Ato: string;
  Nomenclaturas: RegistroOficial[];
}

/** "31/12/9999" (ou data futura) = vigente. */
function estaVigente(dataFim?: string): boolean {
  if (!dataFim) return true;
  const m = dataFim.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return true;
  const [, d, mes, a] = m;
  return new Date(`${a}-${mes}-${d}T23:59:59Z`).getTime() >= Date.now();
}

async function main() {
  const opts = flags();
  console.log("== Importação da nomenclatura NCM ==");

  const { buffer, hash, url } = await obterArquivo("nomenclatura", opts);
  const dados = JSON.parse(buffer.toString("utf8")) as ArquivoOficial;

  const ato = dados.Ato?.trim() || "(ato não informado)";
  const vigenteEm = dados.Data_Ultima_Atualizacao_NCM?.trim() || "(sem data)";
  console.log(`  ato: ${ato}`);
  console.log(`  vigência: ${vigenteEm}`);
  console.log(`  registros no arquivo: ${dados.Nomenclaturas.length}`);

  const jaImportada = opts.reprocessar
    ? null
    : await prisma.baseVersao.findFirst({
        where: { tipo: "nomenclatura", hashArquivo: hash },
      });
  if (jaImportada) {
    console.log(`  arquivo idêntico já importado em ${jaImportada.importadoEm.toISOString()} — nada a fazer.`);
    return;
  }

  // ---- Monta a árvore ----------------------------------------------------
  const vigentes = dados.Nomenclaturas.filter((r) => estaVigente(r.Data_Fim));
  console.log(`  vigentes: ${vigentes.length} (descartados ${dados.Nomenclaturas.length - vigentes.length} expirados)`);

  const porCodigo = new Map<string, RegistroOficial>();
  for (const r of vigentes) {
    const d = apenasDigitos(r.Codigo);
    if (d) porCodigo.set(d, r);
  }

  // Pai = prefixo próprio mais longo que exista na base.
  function acharPai(codigo: string): string | null {
    const prefixos = prefixosAncestrais(codigo);
    for (let i = prefixos.length - 1; i >= 0; i--) {
      if (porCodigo.has(prefixos[i])) return prefixos[i];
    }
    return null;
  }

  const cacheCaminho = new Map<string, string>();
  function montarCaminho(codigo: string): string {
    const cached = cacheCaminho.get(codigo);
    if (cached) return cached;

    const reg = porCodigo.get(codigo);
    const propria = limparTravessoes(limparHtml(reg?.Descricao ?? ""));
    const pai = acharPai(codigo);
    const caminho = pai ? `${montarCaminho(pai)} > ${propria}` : propria;

    cacheCaminho.set(codigo, caminho);
    return caminho;
  }

  const linhas = [...porCodigo.entries()].map(([codigo, reg]) => ({
    codigo,
    codigoFmt: reg.Codigo.trim(),
    nivel: nivelDe(codigo),
    parentCodigo: acharPai(codigo),
    descricao: limparHtml(reg.Descricao ?? ""),
    caminho: montarCaminho(codigo),
    dataInicio: reg.Data_Inicio ?? null,
    dataFim: reg.Data_Fim ?? null,
  }));

  const porNivel = linhas.reduce<Record<string, number>>((acc, l) => {
    acc[l.nivel] = (acc[l.nivel] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  por nível: ${JSON.stringify(porNivel)}`);

  const orfas = linhas.filter((l) => l.nivel !== "capitulo" && !l.parentCodigo);
  if (orfas.length) {
    console.warn(`  ATENÇÃO: ${orfas.length} códigos sem pai (ex.: ${orfas.slice(0, 3).map((o) => o.codigo).join(", ")})`);
  }

  // ---- Grava -------------------------------------------------------------
  // Substituição integral: a versão nova só vira `ativa` no fim, então o app
  // nunca enxerga uma base meio-carregada.
  const versao = await prisma.baseVersao.create({
    data: {
      tipo: "nomenclatura",
      ato,
      vigenteEm,
      fonteUrl: url,
      hashArquivo: hash,
      totalRegistros: linhas.length,
      ativa: false,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.ncmNomenclatura.deleteMany({});
    const LOTE = 1000;
    for (let i = 0; i < linhas.length; i += LOTE) {
      await tx.ncmNomenclatura.createMany({
        data: linhas.slice(i, i + LOTE).map((l) => ({ ...l, baseVersaoId: versao.id })),
      });
    }
    if (opts.ativar) {
      await tx.baseVersao.updateMany({ where: { tipo: "nomenclatura" }, data: { ativa: false } });
      await tx.baseVersao.update({ where: { id: versao.id }, data: { ativa: true } });
    }
  });

  const total = await prisma.ncmNomenclatura.count();
  console.log(`  gravados: ${total} registros (versão ${versao.id}${opts.ativar ? ", ATIVA" : ""})`);
  console.log(`  fonte: ${FONTES.nomenclatura.rotulo}`);
  console.log("  ok. Rode `npm run ncm:index` para reconstruir o índice de busca.");
}

main()
  .catch((e) => {
    console.error("FALHOU:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
