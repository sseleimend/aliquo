/**
 * Fontes oficiais da base fiscal (RNF-2).
 *
 * Três publicações distintas, com atos e cadências diferentes:
 *   - Nomenclatura NCM (códigos, descrições, hierarquia) — Portal Único Siscomex, JSON
 *   - TEC (alíquotas de II)                              — Gecex/MDIC, XLSX
 *   - TIPI (alíquotas de IPI)                            — Receita Federal, XLSX
 *
 * Os arquivos são baixados para var/base/ e hasheados (sha256) para que cada
 * importação seja reproduzível e auditável.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const DIR_BASE = path.resolve(process.cwd(), "var", "base");

export const FONTES = {
  nomenclatura: {
    url: "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json",
    arquivo: "nomenclatura.json",
    rotulo: "Nomenclatura NCM — Portal Único Siscomex",
  },
  tec: {
    url: "https://www.gov.br/mdic/pt-br/assuntos/camex/estrategia-comercial/arquivos-listas/03-08-2026-anexos-i-a-x-resolucao-gecex-272-21.xlsx",
    arquivo: "tec.xlsx",
    rotulo: "TEC — Anexos da Resolução Gecex nº 272/2021",
  },
  tipi: {
    url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi.xlsx",
    arquivo: "tipi.xlsx",
    rotulo: "TIPI — Receita Federal",
  },
} as const;

export type ChaveFonte = keyof typeof FONTES;

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Baixa (ou reaproveita) o arquivo da fonte.
 * `--offline` / OFFLINE=1 usa o que já está em var/base/ sem tocar na rede,
 * o que torna a reimportação determinística em CI e em máquina sem internet.
 */
export async function obterArquivo(
  chave: ChaveFonte,
  opts: { forcarDownload?: boolean; offline?: boolean } = {},
): Promise<{ buffer: Buffer; hash: string; caminho: string; url: string }> {
  const fonte = FONTES[chave];
  const destino = path.join(DIR_BASE, fonte.arquivo);
  await mkdir(DIR_BASE, { recursive: true });

  const temLocal = existsSync(destino);
  const deveBaixar = opts.forcarDownload || (!temLocal && !opts.offline);

  if (!deveBaixar && !temLocal) {
    throw new Error(
      `Arquivo ${fonte.arquivo} não existe em var/base/ e o modo offline foi pedido. ` +
        `Rode sem --offline ao menos uma vez para baixar de ${fonte.url}`,
    );
  }

  if (deveBaixar) {
    process.stdout.write(`  baixando ${fonte.rotulo}...\n`);
    const res = await fetch(fonte.url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Falha ao baixar ${chave}: HTTP ${res.status} em ${fonte.url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) {
      throw new Error(`Download de ${chave} suspeito: apenas ${buf.length} bytes.`);
    }
    await writeFile(destino, buf);
  }

  const buffer = await readFile(destino);
  return { buffer, hash: sha256(buffer), caminho: destino, url: fonte.url };
}

/** Lê flags simples de linha de comando. */
export function flags() {
  const argv = process.argv.slice(2);
  return {
    forcarDownload: argv.includes("--download"),
    offline: argv.includes("--offline") || process.env.OFFLINE === "1",
    ativar: !argv.includes("--sem-ativar"),
    // Reimporta mesmo com o arquivo idêntico — necessário quando a LÓGICA de
    // parsing muda (ex.: passou a limpar HTML) e a fonte não.
    reprocessar: argv.includes("--reprocessar"),
  };
}

/**
 * Converte alíquota publicada em fração decimal.
 * A TEC mistura separadores ("3.6" e "12,6") e anexa marcadores de lista de
 * exceção ("12,6BK" = bem de capital). A TIPI usa "NT" para não-tributado,
 * que é juridicamente diferente de 0%.
 */
export function parseAliquota(bruto: string): {
  valor: number | null;
  naoTributado: boolean;
  marcador: string | null;
} {
  const txt = (bruto ?? "").toString().trim();
  if (!txt) return { valor: null, naoTributado: false, marcador: null };
  if (/^nt$/i.test(txt)) return { valor: null, naoTributado: true, marcador: null };

  const marcadorMatch = txt.match(/([A-Za-z]+)\s*$/);
  const marcador = marcadorMatch ? marcadorMatch[1].toUpperCase() : null;

  const numTxt = txt.replace(/[A-Za-z\s%]/g, "").replace(",", ".");
  if (!numTxt) return { valor: null, naoTributado: false, marcador };

  const n = Number.parseFloat(numTxt);
  if (!Number.isFinite(n) || n < 0) return { valor: null, naoTributado: false, marcador };

  // Publicado em pontos percentuais; guardamos como fração.
  // Arredonda em 6 casas para matar artefatos de float do XLSX (7.800000000000001).
  return { valor: Math.round((n / 100) * 1e6) / 1e6, naoTributado: false, marcador };
}

/** Extrai texto de uma célula do exceljs (que pode vir como richText/formula). */
export function textoCelula(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((t) => t.text ?? "").join("");
    }
    if (typeof o.text === "string") return o.text;
    if (o.result != null) return String(o.result);
    return "";
  }
  return String(v);
}
