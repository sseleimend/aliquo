import { afterEach, describe, expect, it } from "vitest";
import {
  ArquivoInvalidoError,
  dbFileStore,
  getFileStore,
  localFileStore,
  montarChave,
  sha256,
  TAMANHO_MAXIMO,
  validarArquivo,
} from "./index";

describe("validação de upload", () => {
  it("aceita os tipos permitidos e devolve a extensão", () => {
    expect(validarArquivo("application/pdf", 1000)).toBe(".pdf");
    expect(validarArquivo("image/png", 1000)).toBe(".png");
    expect(
      validarArquivo(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1000,
      ),
    ).toBe(".xlsx");
  });

  it("recusa tipo não permitido", () => {
    expect(() => validarArquivo("application/x-msdownload", 100)).toThrow(ArquivoInvalidoError);
    expect(() => validarArquivo("", 100)).toThrow(ArquivoInvalidoError);
  });

  it("recusa arquivo acima do limite e arquivo vazio", () => {
    expect(() => validarArquivo("application/pdf", TAMANHO_MAXIMO + 1)).toThrow(
      ArquivoInvalidoError,
    );
    expect(() => validarArquivo("application/pdf", 0)).toThrow(ArquivoInvalidoError);
  });
});

describe("chaves de armazenamento", () => {
  it("escopa por usuário", () => {
    expect(montarChave("user1", "inv1", ".pdf")).toBe("user1/inv1.pdf");
  });

  it("impede que uma chave manipulada escape do diretório de uploads", async () => {
    // Path traversal não pode alcançar o resto do disco.
    await expect(localFileStore.get("../../../.env")).rejects.toThrow();
    await expect(localFileStore.put("../fora.txt", Buffer.from("x"))).rejects.toThrow();
  });
});

describe("hash de conteúdo", () => {
  it("é estável e distingue conteúdos", () => {
    const a = sha256(Buffer.from("fatura"));
    expect(a).toBe(sha256(Buffer.from("fatura")));
    expect(a).not.toBe(sha256(Buffer.from("fatura ")));
    expect(a).toHaveLength(64);
  });
});

describe("escolha do backend de armazenamento", () => {
  const original = {
    turso: process.env.TURSO_DATABASE_URL,
    driver: process.env.STORAGE_DRIVER,
  };

  function ambiente(turso?: string, driver?: string) {
    if (turso === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = turso;
    if (driver === undefined) delete process.env.STORAGE_DRIVER;
    else process.env.STORAGE_DRIVER = driver;
  }

  afterEach(() => ambiente(original.turso, original.driver));

  it("grava em disco quando o banco é o arquivo local", () => {
    ambiente(undefined, undefined);
    expect(getFileStore()).toBe(localFileStore);
  });

  // O caso que motiva o teste: em host sem disco persistente, cair no backend
  // local significaria aceitar o upload e perdê-lo no próximo deploy.
  it("grava no banco quando o banco é remoto", () => {
    ambiente("libsql://exemplo.turso.io", undefined);
    expect(getFileStore()).toBe(dbFileStore);
  });

  it("STORAGE_DRIVER tem a palavra final nos dois sentidos", () => {
    ambiente("libsql://exemplo.turso.io", "local");
    expect(getFileStore()).toBe(localFileStore);

    ambiente(undefined, "db");
    expect(getFileStore()).toBe(dbFileStore);
  });
});
