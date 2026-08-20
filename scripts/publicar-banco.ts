/**
 * Carrega o banco preparado (`var/producao.db`) para dentro do Turso.
 *
 * Existe porque `turso db create --from-file` só funciona na criação e só pela
 * CLI: banco criado pelo painel nasce vazio, e conectar a aplicação a ele daria
 * "no such table". Aqui o arquivo local é lido pelo próprio cliente libSQL —
 * o mesmo que fala com o remoto — e copiado objeto por objeto.
 *
 * Copia inclusive a tabela virtual FTS5: o `CREATE VIRTUAL TABLE` é reexecutado
 * no destino e as linhas são reinseridas, o que faz o índice ser reconstruído
 * do outro lado. As tabelas-sombra (NcmFts_data, _idx, ...) NÃO são copiadas;
 * elas são consequência da virtual, não fonte.
 *
 * Uso:  npx tsx scripts/publicar-banco.ts [--origem var/producao.db] [--forcar]
 *
 * Recusa sobrescrever banco que já tem dados, a menos que --forcar.
 */

import "./lib/env";
import { createClient, type Client, type InValue } from "@libsql/client";

const args = process.argv.slice(2);
function opcao(nome: string, padrao: string): string {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
}
const ORIGEM = opcao("origem", "var/producao.db");
const FORCAR = args.includes("--forcar");
const LOTE = 200;

interface ObjetoSchema {
  type: string;
  name: string;
  sql: string;
}

async function lerSchema(origem: Client): Promise<ObjetoSchema[]> {
  const r = await origem.execute(
    `SELECT type, name, sql FROM sqlite_schema
      WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`,
  );
  return r.rows.map((linha) => ({
    type: String(linha.type),
    name: String(linha.name),
    sql: String(linha.sql),
  }));
}

/** Nomes das tabelas-sombra criadas automaticamente por cada virtual table. */
function sombras(objetos: ObjetoSchema[]): Set<string> {
  const virtuais = objetos
    .filter((o) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(o.sql))
    .map((o) => o.name);
  const nomes = new Set<string>();
  for (const o of objetos) {
    if (virtuais.includes(o.name)) continue;
    if (virtuais.some((v) => o.name.startsWith(`${v}_`))) nomes.add(o.name);
  }
  return nomes;
}

async function copiarTabela(origem: Client, destino: Client, tabela: string): Promise<number> {
  const dados = await origem.execute(`SELECT * FROM "${tabela}"`);
  if (dados.rows.length === 0) return 0;

  const colunas = dados.columns;
  const listaColunas = colunas.map((c) => `"${c}"`).join(", ");
  const marcadores = colunas.map(() => "?").join(", ");
  const sql = `INSERT INTO "${tabela}" (${listaColunas}) VALUES (${marcadores})`;

  let enviadas = 0;
  for (let i = 0; i < dados.rows.length; i += LOTE) {
    const fatia = dados.rows.slice(i, i + LOTE);
    await destino.batch(
      fatia.map((linha) => ({
        sql,
        args: colunas.map((c) => (linha as Record<string, unknown>)[c] as InValue),
      })),
      "write",
    );
    enviadas += fatia.length;
    process.stdout.write(`\r  ${tabela}: ${enviadas}/${dados.rows.length}`);
  }
  process.stdout.write("\n");
  return enviadas;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL não definida.");
  if (url.startsWith("file:")) throw new Error("TURSO_DATABASE_URL aponta para arquivo local.");

  const origem = createClient({ url: `file:${ORIGEM}` });
  const destino = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  console.log(`Origem : ${ORIGEM}`);
  console.log(`Destino: ${url}\n`);

  const jaExiste = await destino.execute(
    "SELECT count(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const tabelasNoDestino = Number(jaExiste.rows[0].n);
  if (tabelasNoDestino > 0 && !FORCAR) {
    throw new Error(
      `O destino já tem ${tabelasNoDestino} tabela(s). Publicar por cima apagaria ` +
        "dados de usuário. Use --forcar se for mesmo isso que você quer.",
    );
  }

  const objetos = await lerSchema(origem);
  const ignorar = sombras(objetos);
  const tabelas = objetos.filter((o) => o.type === "table" && !ignorar.has(o.name));
  const indices = objetos.filter((o) => o.type === "index" && !ignorar.has(o.name));
  const gatilhos = objetos.filter((o) => o.type === "trigger");

  console.log(`== Schema (${tabelas.length} tabelas, ${indices.length} índices) ==`);
  if (FORCAR && tabelasNoDestino > 0) {
    for (const t of [...tabelas].reverse()) {
      await destino.execute(`DROP TABLE IF EXISTS "${t.name}"`);
    }
  }
  for (const t of tabelas) {
    await destino.execute(t.sql);
    if (/^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(t.sql)) console.log(`  ${t.name} (virtual FTS5)`);
  }
  for (const i of indices) await destino.execute(i.sql);
  for (const g of gatilhos) await destino.execute(g.sql);
  console.log("  schema criado\n");

  console.log("== Dados ==");
  let total = 0;
  for (const t of tabelas) {
    total += await copiarTabela(origem, destino, t.name);
  }

  console.log(`\n== Conferência ==`);
  let divergencias = 0;
  for (const t of tabelas) {
    const [a, b] = await Promise.all([
      origem.execute(`SELECT count(*) AS n FROM "${t.name}"`),
      destino.execute(`SELECT count(*) AS n FROM "${t.name}"`),
    ]);
    const na = Number(a.rows[0].n);
    const nb = Number(b.rows[0].n);
    if (na !== nb) {
      console.log(`  DIVERGE ${t.name}: origem ${na}, destino ${nb}`);
      divergencias++;
    }
  }
  console.log(
    divergencias === 0
      ? `  todas as ${tabelas.length} tabelas com a mesma contagem (${total} linhas copiadas)`
      : `  ${divergencias} tabela(s) divergindo`,
  );

  origem.close();
  destino.close();
  if (divergencias > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\nFALHA: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
