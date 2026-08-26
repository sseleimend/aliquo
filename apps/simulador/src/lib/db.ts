/**
 * Cliente Prisma — um único ponto decide ONDE o banco vive.
 *
 * Local: arquivo SQLite (`DATABASE_URL="file:./dev.db"`).
 * Produção: Turso (libSQL) via driver adapter, quando `TURSO_DATABASE_URL`
 * está presente. O dialeto é o mesmo — inclusive a tabela virtual FTS5 e o
 * `bm25()` de `src/lib/ncm/retrieval.ts` — então nenhuma query muda de forma.
 *
 * A escolha é por variável de ambiente, e não por NODE_ENV, para que os
 * scripts de base (`npm run base:import`, `npm run ncm:index`) possam apontar
 * para produção sem virar um modo especial dentro do código.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Sem nenhuma das duas variáveis não há banco, e o erro cru do Prisma
 * ("Environment variable not found") não diz o que fazer. Falha dizendo.
 *
 * Não dá para checar mais do que isso aqui: este módulo é alcançado pelo bundle
 * de cliente (via `src/lib/tax/rates.ts`), então nada de `node:fs`.
 */
function conferirConfiguracao(): void {
  // No navegador não existe `process.env`, e este módulo CHEGA ao bundle de
  // cliente através de `src/lib/tax/rates.ts`. Lá o PrismaClient é o stub do
  // browser, que nunca consulta nada — checar configuração derrubaria a página
  // inteira por um problema que só existe no servidor.
  if (typeof window !== "undefined") return;
  if (process.env.DATABASE_URL) return;

  throw new Error(
    "Banco não configurado: defina TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) " +
      "em host sem disco persistente, ou DATABASE_URL para um arquivo SQLite local.",
  );
}

type NivelLog = "error" | "warn";

function niveisDeLog(): NivelLog[] {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

/**
 * Transações interativas com folga para a rede — e só para isso.
 *
 * O padrão do Prisma é 5 s, dimensionado para SQLite em disco. Contra o Turso
 * cada statement é uma ida e volta de ~140 ms, então uma transação com uma
 * dezena deles precisa de mais espaço.
 *
 * O teto NÃO é generoso de propósito: se uma transação bater neste limite, a
 * causa provável não é lentidão, é impasse — alguém consultando pelo cliente
 * global dentro da transação, esperando a conexão que ela mesma segura. O sinal
 * é o tempo decorrido bater exatamente no timeout, seja ele qual for.
 */
const OPCOES_TRANSACAO = {
  maxWait: 5_000, // espera por conexão livre
  timeout: 10_000, // duração máxima da transação
};

/**
 * Cria um cliente novo. Use nos scripts de linha de comando, que abrem e
 * fecham a própria conexão; a aplicação usa o singleton `prisma` abaixo.
 */
export function criarPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    conferirConfiguracao();
    return new PrismaClient({ log: niveisDeLog(), transactionOptions: OPCOES_TRANSACAO });
  }

  const adapter = new PrismaLibSQL({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter, log: niveisDeLog(), transactionOptions: OPCOES_TRANSACAO });
}

/** True quando o banco em uso é o remoto (Turso), não o arquivo local. */
export function bancoRemoto(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

// Singleton do Prisma para evitar múltiplas conexões em dev (hot reload).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? criarPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
