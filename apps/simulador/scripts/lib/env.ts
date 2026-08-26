/**
 * Carrega variáveis de ambiente para os scripts de linha de comando.
 *
 * O Next carrega `.env` sozinho; `tsx script.ts` não. Importar este módulo
 * ANTES de `criarPrismaClient` resolve isso sem dependência nova.
 *
 * O ambiente do shell SEMPRE vence o arquivo. É o que permite apontar um
 * script para produção numa execução só, sem editar arquivo nenhum:
 *
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run ncm:index   (bash)
 *   $env:TURSO_DATABASE_URL="..."; npm run ncm:index                (PowerShell)
 *
 * `ENV_FILE` troca o arquivo lido (ex.: `ENV_FILE=.env.producao`).
 */

import { existsSync, readFileSync } from "node:fs";

const arquivo = process.env.ENV_FILE || ".env";

if (existsSync(arquivo)) {
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("#")) continue;

    const separador = texto.indexOf("=");
    if (separador <= 0) continue;

    const chave = texto.slice(0, separador).trim();
    if (chave in process.env) continue; // shell vence

    let valor = texto.slice(separador + 1).trim();
    const aspas = valor[0];
    if ((aspas === '"' || aspas === "'") && valor.endsWith(aspas)) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
  }
}
