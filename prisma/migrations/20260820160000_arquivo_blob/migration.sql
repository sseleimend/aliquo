-- Bytes dos uploads no banco, para sobreviver a hosts sem disco persistente.
-- Escrita a mao (nao gerada por `migrate diff`) de proposito: o diff quer
-- emitir DROP TABLE "NcmFts", que e o indice FTS5 fora do controle do Prisma.
CREATE TABLE "ArquivoBlob" (
    "chave" TEXT NOT NULL PRIMARY KEY,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BLOB NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
