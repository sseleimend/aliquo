-- DropIndex
DROP INDEX "Simulacao_userId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Simulacao";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "regimeTributario" TEXT NOT NULL DEFAULT 'lucro_real',
    "ufPadrao" TEXT NOT NULL DEFAULT 'SP',
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Empresa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BaseVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "ato" TEXT NOT NULL,
    "vigenteEm" TEXT NOT NULL,
    "fonteUrl" TEXT NOT NULL,
    "hashArquivo" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "importadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NcmNomenclatura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "codigoFmt" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "parentCodigo" TEXT,
    "descricao" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "dataInicio" TEXT,
    "dataFim" TEXT,
    "baseVersaoId" TEXT NOT NULL,
    CONSTRAINT "NcmNomenclatura_baseVersaoId_fkey" FOREIGN KEY ("baseVersaoId") REFERENCES "BaseVersao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NcmSinonimo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "termo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "peso" REAL NOT NULL DEFAULT 1,
    "origem" TEXT NOT NULL DEFAULT 'curado'
);

-- CreateTable
CREATE TABLE "NcmAliquota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "ex" TEXT NOT NULL DEFAULT '',
    "ii" REAL,
    "ipi" REAL,
    "ipiNT" BOOLEAN NOT NULL DEFAULT false,
    "pis" REAL,
    "cofins" REAL,
    "origemII" TEXT,
    "marcadorII" TEXT,
    "origemIPI" TEXT,
    "iiBaseVersao" TEXT,
    "ipiBaseVersao" TEXT,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NcmAliquota_iiBaseVersao_fkey" FOREIGN KEY ("iiBaseVersao") REFERENCES "BaseVersao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NcmAliquota_ipiBaseVersao_fkey" FOREIGN KEY ("ipiBaseVersao") REFERENCES "BaseVersao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NcmFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "descricaoOriginal" TEXT NOT NULL,
    "termosExpandidos" TEXT NOT NULL DEFAULT '[]',
    "candidatosJson" TEXT NOT NULL DEFAULT '[]',
    "ncmEscolhido" TEXT NOT NULL,
    "escolhidoEstavaNaLista" BOOLEAN NOT NULL DEFAULT true,
    "perguntasFeitas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AliquotaUf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uf" TEXT NOT NULL,
    "aliquota" REAL NOT NULL,
    "fecp" REAL NOT NULL DEFAULT 0,
    "vigenciaIni" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaFim" DATETIME,
    "fonte" TEXT NOT NULL DEFAULT 'estimativa'
);

-- CreateTable
CREATE TABLE "FxCotacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moeda" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "dataRef" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'venda',
    "asOf" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Importacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT,
    "invoiceId" TEXT,
    "apelido" TEXT,
    "status" TEXT NOT NULL DEFAULT 'simulada',
    "uf" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "incoterm" TEXT NOT NULL DEFAULT 'FOB',
    "modal" TEXT,
    "regimeTributario" TEXT NOT NULL DEFAULT 'lucro_real',
    "dataReferencia" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rulesetId" TEXT NOT NULL,
    "baseVersaoId" TEXT,
    "fxCotacaoId" TEXT,
    "fxRate" REAL NOT NULL,
    "fxFonte" TEXT,
    "fxAsOf" DATETIME,
    "fxDataRef" TEXT,
    "fxStale" BOOLEAN NOT NULL DEFAULT false,
    "contextoJson" TEXT NOT NULL DEFAULT '{}',
    "inputJson" TEXT NOT NULL,
    "resultadoJson" TEXT NOT NULL,
    "landedCost" REAL NOT NULL DEFAULT 0,
    "landedCostEfetivo" REAL,
    "provisorio" BOOLEAN NOT NULL DEFAULT false,
    "duplicadaDeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Importacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Importacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Importacao_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Importacao_fxCotacaoId_fkey" FOREIGN KEY ("fxCotacaoId") REFERENCES "FxCotacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Importacao_baseVersaoId_fkey" FOREIGN KEY ("baseVersaoId") REFERENCES "BaseVersao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportacaoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importacaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "descricaoProduto" TEXT,
    "ncm" TEXT NOT NULL,
    "ncmDescricaoOficial" TEXT,
    "ncmCaminhoOficial" TEXT,
    "ncmFonte" TEXT NOT NULL DEFAULT 'manual',
    "ncmConfianca" REAL,
    "ncmConfirmadoEm" DATETIME,
    "atributosJson" TEXT NOT NULL DEFAULT '[]',
    "quantidade" REAL NOT NULL DEFAULT 1,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "valorUnitarioMoeda" REAL NOT NULL DEFAULT 0,
    "pesoLiquidoKg" REAL,
    "aliquotaIIManual" REAL,
    "aliquotaIPIManual" REAL,
    "resultadoJson" TEXT,
    "landedCost" REAL,
    CONSTRAINT "ImportacaoItem_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportacaoCusto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importacaoId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "valor" REAL NOT NULL DEFAULT 0,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "compoeValorAduaneiro" BOOLEAN NOT NULL DEFAULT false,
    "entraBaseIcms" BOOLEAN NOT NULL DEFAULT false,
    "criterioRateio" TEXT NOT NULL DEFAULT 'valor',
    "origem" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "ImportacaoCusto_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "numero" TEXT,
    "fornecedor" TEXT,
    "dataEmissao" TEXT,
    "moeda" TEXT NOT NULL DEFAULT 'USD',
    "valorTotal" REAL NOT NULL DEFAULT 0,
    "arquivoKey" TEXT,
    "arquivoNome" TEXT,
    "arquivoMime" TEXT,
    "arquivoTamanho" INTEGER,
    "arquivoSha256" TEXT,
    "extraidoJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT,
    "quantidade" REAL NOT NULL DEFAULT 1,
    "valorUnitario" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoMensalCentavos" INTEGER NOT NULL DEFAULT 0,
    "limitesJson" TEXT NOT NULL DEFAULT '{}',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "periodoInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodoFim" DATETIME,
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assinatura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assinatura_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsoMensal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsoMensal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoUso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "custoEstimadoCentavos" INTEGER NOT NULL DEFAULT 0,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoUso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "preferenciaModo" TEXT NOT NULL DEFAULT 'guiado',
    "aceiteTermosEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "image", "name", "passwordHash") SELECT "createdAt", "email", "id", "image", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Empresa_userId_idx" ON "Empresa"("userId");

-- CreateIndex
CREATE INDEX "BaseVersao_tipo_ativa_idx" ON "BaseVersao"("tipo", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "NcmNomenclatura_codigo_key" ON "NcmNomenclatura"("codigo");

-- CreateIndex
CREATE INDEX "NcmNomenclatura_nivel_idx" ON "NcmNomenclatura"("nivel");

-- CreateIndex
CREATE INDEX "NcmNomenclatura_parentCodigo_idx" ON "NcmNomenclatura"("parentCodigo");

-- CreateIndex
CREATE INDEX "NcmNomenclatura_baseVersaoId_idx" ON "NcmNomenclatura"("baseVersaoId");

-- CreateIndex
CREATE INDEX "NcmSinonimo_termo_idx" ON "NcmSinonimo"("termo");

-- CreateIndex
CREATE UNIQUE INDEX "NcmSinonimo_termo_codigo_key" ON "NcmSinonimo"("termo", "codigo");

-- CreateIndex
CREATE INDEX "NcmAliquota_codigo_idx" ON "NcmAliquota"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "NcmAliquota_codigo_ex_key" ON "NcmAliquota"("codigo", "ex");

-- CreateIndex
CREATE INDEX "NcmFeedback_escolhidoEstavaNaLista_createdAt_idx" ON "NcmFeedback"("escolhidoEstavaNaLista", "createdAt");

-- CreateIndex
CREATE INDEX "AliquotaUf_uf_idx" ON "AliquotaUf"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "AliquotaUf_uf_vigenciaIni_key" ON "AliquotaUf"("uf", "vigenciaIni");

-- CreateIndex
CREATE INDEX "FxCotacao_moeda_finalidade_dataRef_idx" ON "FxCotacao"("moeda", "finalidade", "dataRef");

-- CreateIndex
CREATE UNIQUE INDEX "FxCotacao_moeda_fonte_finalidade_dataRef_key" ON "FxCotacao"("moeda", "fonte", "finalidade", "dataRef");

-- CreateIndex
CREATE INDEX "Importacao_userId_idx" ON "Importacao"("userId");

-- CreateIndex
CREATE INDEX "Importacao_userId_createdAt_idx" ON "Importacao"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Importacao_empresaId_status_idx" ON "Importacao"("empresaId", "status");

-- CreateIndex
CREATE INDEX "ImportacaoItem_importacaoId_idx" ON "ImportacaoItem"("importacaoId");

-- CreateIndex
CREATE INDEX "ImportacaoItem_ncm_idx" ON "ImportacaoItem"("ncm");

-- CreateIndex
CREATE INDEX "ImportacaoCusto_importacaoId_idx" ON "ImportacaoCusto"("importacaoId");

-- CreateIndex
CREATE INDEX "Invoice_userId_createdAt_idx" ON "Invoice"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Plano_codigo_key" ON "Plano"("codigo");

-- CreateIndex
CREATE INDEX "Assinatura_planoId_idx" ON "Assinatura"("planoId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_userId_key" ON "Assinatura"("userId");

-- CreateIndex
CREATE INDEX "UsoMensal_userId_idx" ON "UsoMensal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsoMensal_userId_competencia_tipo_key" ON "UsoMensal"("userId", "competencia", "tipo");

-- CreateIndex
CREATE INDEX "EventoUso_userId_createdAt_idx" ON "EventoUso"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EventoUso_tipo_createdAt_idx" ON "EventoUso"("tipo", "createdAt");

