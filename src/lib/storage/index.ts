/**
 * Armazenamento de arquivos (RF-D2) atrás de uma interface.
 *
 * Duas implementações, escolhidas por ambiente:
 *
 *   local -> `var/uploads/`, FORA de `public/` de propósito: nada aqui pode
 *            ser servido por URL adivinhável. Bom em desenvolvimento.
 *   db    -> bytes numa tabela do próprio banco. É o modo de produção, porque
 *            host gratuito não tem disco persistente: o sistema de arquivos
 *            volta ao estado da imagem a cada restart e o upload sumiria.
 *
 * Em ambos, o acesso passa por uma rota que confere o dono do arquivo.
 * Trocar por S3/R2 é implementar a mesma interface; nenhum chamador muda.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { bancoRemoto, prisma } from "@/lib/db";

export interface FileStore {
  readonly nome: string;
  /** `mime` só é usado por backends que guardam o tipo junto dos bytes. */
  put(chave: string, dados: Buffer, mime?: string): Promise<void>;
  get(chave: string): Promise<Buffer>;
  delete(chave: string): Promise<void>;
}

const RAIZ = path.resolve(process.cwd(), "var", "uploads");

/**
 * Rejeita chave manipulada.
 *
 * REJEITA em vez de sanear: saneando, "../x" e "x" virariam a mesma chave e
 * dois arquivos distintos colidiriam. As chaves são geradas por `montarChave`,
 * então qualquer coisa fora do formato esperado é sinal de problema e deve
 * falhar ruidosamente — inclusive no backend de banco, onde a chave é opaca e
 * um valor estranho denuncia bug ou tentativa de abuso.
 */
export function chaveSegura(chave: string): string {
  const normalizada = chave.replace(/\\/g, "/");

  const suspeita =
    !normalizada ||
    normalizada.includes("..") ||
    normalizada.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizada) ||
    normalizada.includes("\0");

  if (suspeita) throw new Error("Chave de arquivo inválida.");
  return normalizada;
}

/** Impede que uma chave manipulada escape do diretório de uploads. */
function caminhoSeguro(chave: string): string {
  const destino = path.resolve(RAIZ, chaveSegura(chave));
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

/**
 * Bytes na tabela `ArquivoBlob`, na mesma transação lógica do resto dos dados.
 *
 * `put` é upsert: reenviar o arquivo de uma fatura sobrescreve o anterior em
 * vez de duplicar, espelhando o comportamento de gravar por cima no disco.
 */
export const dbFileStore: FileStore = {
  nome: "db",

  async put(chave, dados, mime) {
    const registro = {
      mime: mime || "application/octet-stream",
      tamanho: dados.byteLength,
      // Prisma tipa Bytes como Uint8Array; Buffer e um subtipo com ArrayBufferLike.
      dados: new Uint8Array(dados),
    };
    await prisma.arquivoBlob.upsert({
      where: { chave: chaveSegura(chave) },
      update: registro,
      create: { chave: chaveSegura(chave), ...registro },
    });
  },

  async get(chave) {
    const registro = await prisma.arquivoBlob.findUnique({
      where: { chave: chaveSegura(chave) },
      select: { dados: true },
    });
    // Mesma semântica do disco: ausência é erro, e o chamador devolve 410.
    if (!registro) throw new Error(`Arquivo ausente no armazenamento: ${chave}`);
    return Buffer.from(registro.dados);
  },

  async delete(chave) {
    await prisma.arquivoBlob.deleteMany({ where: { chave: chaveSegura(chave) } });
  },
};

/**
 * Escolhe o backend.
 *
 * O padrão segue o banco: se o banco é remoto, o host quase certamente não tem
 * disco persistente, então gravar em `var/uploads/` seria perder o arquivo no
 * próximo deploy. `STORAGE_DRIVER` força um dos dois quando preciso.
 */
export function getFileStore(): FileStore {
  const escolhido = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (escolhido === "local") return localFileStore;
  if (escolhido === "db") return dbFileStore;
  return bancoRemoto() ? dbFileStore : localFileStore;
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
