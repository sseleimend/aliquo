-- ATENCAO: as linhas de DROP das tabelas "NcmFts*" foram REMOVIDAS deste migration.
-- O indice FTS5 e derivado de NcmNomenclatura + NcmSinonimo e nao e gerenciado
-- pelo Prisma; toda migration gerada tenta derruba-lo. Ver README, secao "Indice FTS5".
-- Se por algum motivo o indice sumir, rode: npm run ncm:index
-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventoUso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "provider" TEXT,
    "model" TEXT,
    "modeloCusto" TEXT,
    "custoEstimadoCentavos" INTEGER,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoUso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventoUso" ("createdAt", "custoEstimadoCentavos", "id", "metaJson", "quantidade", "tipo", "userId") SELECT "createdAt", "custoEstimadoCentavos", "id", "metaJson", "quantidade", "tipo", "userId" FROM "EventoUso";
DROP TABLE "EventoUso";
ALTER TABLE "new_EventoUso" RENAME TO "EventoUso";
CREATE INDEX "EventoUso_userId_createdAt_idx" ON "EventoUso"("userId", "createdAt");
CREATE INDEX "EventoUso_tipo_createdAt_idx" ON "EventoUso"("tipo", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

