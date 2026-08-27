/**
 * Testes nunca tocam o banco de produção.
 *
 * Vários testes gravam e apagam registros (cota mensal, contexto de ICMS). Com
 * as credenciais do Turso no `.env` — que é o normal depois de publicar — eles
 * passariam a fazer isso em produção sem ninguém pedir. Aqui a variável é
 * esvaziada ANTES de qualquer import do Prisma, então a suíte cai no arquivo
 * local de `DATABASE_URL`.
 *
 * Esvaziar, e não apagar: o `@prisma/client` carrega o `.env` sozinho quando é
 * importado, e uma chave AUSENTE ele repõe. Uma chave presente e vazia, não —
 * e vazia já é falsa para `bancoRemoto()`.
 *
 * Para rodar de propósito contra o remoto: PERMITIR_BANCO_REMOTO=1 npm test
 */

import "./scripts/lib/env";

if (process.env.TURSO_DATABASE_URL && !process.env.PERMITIR_BANCO_REMOTO) {
  process.env.TURSO_DATABASE_URL = "";
  process.env.TURSO_AUTH_TOKEN = "";
  console.warn("[testes] TURSO_DATABASE_URL ignorada — a suíte roda no banco local.");
}
