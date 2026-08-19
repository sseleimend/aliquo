-- ATENCAO: tabela virtual FTS5, NAO GERENCIADA PELO PRISMA.
-- E um indice DERIVADO de "NcmNomenclatura" + "NcmSinonimo" -- nunca fonte de verdade.
-- Pode ser reconstruido a qualquer momento com `npm run ncm:index`.
--
-- Como o Prisma nao modela virtual tables, um `prisma migrate diff` futuro vai
-- querer emitir DROP TABLE "NcmFts". Ao gerar novas migrations, REMOVA essa linha
-- do SQL gerado e rode `npm run ncm:index` para reconstruir o indice.
--
-- remove_diacritics 2 = busca insensivel a acento (essencial em pt-BR).
-- Sem ICU no build do SQLite embarcado, unicode61 e o tokenizer correto.

DROP TABLE IF EXISTS "NcmFts";

CREATE VIRTUAL TABLE "NcmFts" USING fts5(
  codigo UNINDEXED,
  nivel UNINDEXED,
  descricao,
  caminho,
  sinonimos,
  tokenize = 'unicode61 remove_diacritics 2'
);
