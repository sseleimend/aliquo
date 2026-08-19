/**
 * Armazenamento de arquivos (RF-D2) atrás de uma interface.
 *
 * A implementação atual grava em disco local, em `var/uploads/` — FORA de
 * `public/`, de propósito: nada aqui pode ser servido por URL adivinhável.
 * O acesso passa sempre por uma rota que confere o dono do arquivo.
 *
 * Trocar por S3/Blob é implementar a mesma interface; nenhum chamador muda.
 * (Disco local não sobrevive a deploy serverless — quando isso for o alvo,
 * é aqui que a troca acontece.)
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileStore {
  readonly nome: string;
  put(chave: string, dados: Buffer): Promise<void>;
  get(chave: string): Promise<Buffer>;
  delete(chave: string): Promise<void>;
}

const RAIZ = path.resolve(process.cwd(), "var", "uploads");

/**
 * Impede que uma chave manipulada escape do diretório de uploads.
 *
 * REJEITA em vez de sanear: saneando, "../x" e "x" virariam o mesmo caminho e
 * duas chaves distintas colidiriam no mesmo arquivo. As chaves são geradas por
 * `montarChave`, então qualquer coisa fora do formato esperado é sinal de
 * problema e deve falhar ruidosamente.
 */
function caminhoSeguro(chave: string): string {
  const normalizada = chave.replace(/\\/g, "/");

  const suspeita =
    !normalizada ||
    normalizada.includes("..") ||
    normalizada.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizada) ||
    normalizada.includes("\0");

  if (suspeita) throw new Error("Chave de arquivo inválida.");

  const destino = path.resolve(RAIZ, normalizada);
  if (!destino.startsWith(RAIZ + path.sep)) {
    throw new Error("Chave de arquivo inválida.");
  }
  return destino;
}

export const localFileStore: FileStore = {
  nome: "local",

  async put(chave, dados) {
    const destino = caminhoSeguro(chave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, dados);
  },

  async get(chave) {
    return readFile(caminhoSeguro(chave));
  },

  async delete(chave) {
    await rm(caminhoSeguro(chave), { force: true });
  },
};

export function getFileStore(): FileStore {
  return localFileStore;
}

// ---------------------------------------------------------------------------
// Validação de upload
// ---------------------------------------------------------------------------

export const MIMES_PERMITIDOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "text/csv": ".csv",
};

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export class ArquivoInvalidoError extends Error {
  readonly status = 400;
}

export function validarArquivo(mime: string, tamanho: number): string {
  const ext = MIMES_PERMITIDOS[mime];
  if (!ext) {
    throw new ArquivoInvalidoError(
      `Tipo de arquivo não aceito (${mime || "desconhecido"}). ` +
        `Envie PDF, imagem, planilha ou CSV.`,
    );
  }
  if (tamanho > TAMANHO_MAXIMO) {
    throw new ArquivoInvalidoError(
      `Arquivo maior que ${Math.round(TAMANHO_MAXIMO / 1024 / 1024)} MB.`,
    );
  }
  if (tamanho <= 0) {
    throw new ArquivoInvalidoError("Arquivo vazio.");
  }
  return ext;
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Chave de armazenamento — escopada por usuário para facilitar limpeza. */
export function montarChave(userId: string, invoiceId: string, ext: string): string {
  return `${userId}/${invoiceId}${ext}`;
}
