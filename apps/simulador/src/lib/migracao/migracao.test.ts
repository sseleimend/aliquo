import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ABA_DADOS, COLUNAS, gerarTemplate, lerPlanilha } from "./template";
import { extrairPayloadPdf, montarPayloadPdf, payloadParaEmbarque } from "./payload";
import type { EntradaCalculo, ResultadoCalculo } from "@/lib/tax/types";

/** Monta uma planilha no formato do modelo, a partir de linhas simples. */
async function planilha(linhas: Array<Record<string, unknown>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ABA_DADOS);
  ws.columns = COLUNAS.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura }));
  for (const l of linhas) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const linhaBase = {
  referencia: "IMP-001",
  uf: "SP",
  moeda: "USD",
  taxaCambio: 5.2,
  regime: "lucro_real",
  ncm: "8508.11.00",
  descricao: "Robô aspirador",
  quantidade: 10,
  valorUnitario: 120,
  frete: 2400,
  criterioRateio: "peso",
};

describe("template de migração", () => {
  it("gera uma planilha com a aba de dados e o cabeçalho esperado", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarTemplate()) as unknown as ArrayBuffer);

    const ws = wb.getWorksheet(ABA_DADOS);
    expect(ws).toBeDefined();
    const titulos = COLUNAS.map((c) => c.titulo);
    const cabecalho = ws!.getRow(1).values as string[];
    for (const t of titulos) expect(cabecalho).toContain(t);
  });

  it("reenviar o modelo sem editar não cria importação fantasma", async () => {
    // Regressão: as linhas de demonstração tinham referência de aparência
    // real e eram importadas como se fossem dados do usuário.
    const { embarques } = await lerPlanilha(await gerarTemplate());
    expect(embarques).toHaveLength(0);
  });
});

describe("leitura da planilha", () => {
  it("agrupa itens pela referência e lê os campos do embarque", async () => {
    const buf = await planilha([
      linhaBase,
      { ...linhaBase, ncm: "8544.42.00", descricao: "Cabo", quantidade: 200, valorUnitario: 8.5 },
      { ...linhaBase, referencia: "IMP-002", ncm: "8508.11.00", quantidade: 1, valorUnitario: 500 },
    ]);

    const { embarques, erros } = await lerPlanilha(buf);
    expect(erros).toHaveLength(0);
    expect(embarques).toHaveLength(2);

    const primeiro = embarques.find((e) => e.referencia === "IMP-001")!;
    expect(primeiro.itens).toHaveLength(2);
    expect(primeiro.uf).toBe("SP");
    expect(primeiro.frete).toBe(2400);
    expect(primeiro.criterioRateio).toBe("peso");
    expect(primeiro.itens.map((i) => i.ncm)).toEqual(["85081100", "85444200"]);
  });

  it("recusa NCM inválida em vez de importar lixo", async () => {
    const { embarques, erros } = await lerPlanilha(
      await planilha([{ ...linhaBase, ncm: "85081" }]),
    );
    expect(embarques).toHaveLength(0);
    expect(erros[0].campo).toBe("ncm");
  });

  it("recusa linha sem referência — sem ela não há agrupamento", async () => {
    const { erros } = await lerPlanilha(await planilha([{ ...linhaBase, referencia: "" }]));
    expect(erros.some((e) => e.campo === "referencia")).toBe(true);
  });

  it("recusa valor unitário zerado", async () => {
    const { erros } = await lerPlanilha(await planilha([{ ...linhaBase, valorUnitario: 0 }]));
    expect(erros.some((e) => e.campo === "valorUnitario")).toBe(true);
  });

  it("uma linha ruim não derruba as boas", async () => {
    const { embarques, erros } = await lerPlanilha(
      await planilha([linhaBase, { ...linhaBase, referencia: "IMP-003", ncm: "xx" }]),
    );
    expect(embarques).toHaveLength(1);
    expect(erros).toHaveLength(1);
  });

  it("aceita colunas fora de ordem — as pessoas remanejam a planilha delas", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(ABA_DADOS);
    ws.addRow(["NCM", "Quantidade", "Referência", "UF de destino", "Valor unitário"]);
    ws.addRow(["8508.11.00", 5, "IMP-X", "RJ", 99]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const { embarques, erros } = await lerPlanilha(buf);
    expect(erros).toHaveLength(0);
    expect(embarques[0].uf).toBe("RJ");
    expect(embarques[0].itens[0].quantidade).toBe(5);
  });

  it("avisa quando falta coluna obrigatória, em vez de importar pela metade", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(ABA_DADOS);
    ws.addRow(["Referência", "UF de destino"]); // sem NCM/quantidade/valor
    ws.addRow(["IMP-Y", "SP"]);
    const { embarques, erros } = await lerPlanilha(Buffer.from(await wb.xlsx.writeBuffer()));

    expect(embarques).toHaveLength(0);
    expect(erros.map((e) => e.campo)).toContain("ncm");
  });
});

describe("payload embutido no PDF", () => {
  const entrada: EntradaCalculo = {
    moeda: "USD",
    taxaCambio: 5.2,
    uf: "SP",
    itens: [
      { ncm: "85081100", descricaoProduto: "Robô", quantidade: 10, valorUnitarioMoeda: 120 },
    ],
    custos: [
      {
        chave: "frete",
        rotulo: "Frete internacional",
        valor: 2400,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "peso",
      },
    ],
  };
  const resultado = { landedCost: 15000 } as ResultadoCalculo;

  it("codifica e decodifica sem perda", () => {
    const b64 = montarPayloadPdf({ resultado, entrada, apelido: "Meu embarque" });
    // Simula o PDF: o campo aparece no dicionário Info em texto plano.
    const pdfFalso = Buffer.from(`%PDF-1.3\n/AliquoDados (${b64})\n%%EOF`, "latin1");

    const p = extrairPayloadPdf(pdfFalso);
    expect(p).not.toBeNull();
    expect(p!.entrada.itens[0].ncm).toBe("85081100");
    expect(p!.landedCostOriginal).toBe(15000);
    expect(p!.apelido).toBe("Meu embarque");
  });

  it("lê o payload quando o valor é um OBJETO INDIRETO", () => {
    // Regressão: é assim que o pdfkit realmente grava — o dicionário aponta
    // para `/AliquoDados 13 0 R` e o valor mora num objeto separado. A
    // primeira versão do extrator só olhava o formato inline e devolvia null
    // para todo PDF que o próprio app gerava.
    const b64 = montarPayloadPdf({ resultado, entrada, apelido: "Indireto" });
    const pdfFalso = Buffer.from(
      `%PDF-1.3
13 0 obj
(${b64})
endobj
9 0 obj
<<
/AliquoDados 13 0 R
>>
endobj
%%EOF`,
      "latin1",
    );

    const p = extrairPayloadPdf(pdfFalso);
    expect(p).not.toBeNull();
    expect(p!.apelido).toBe("Indireto");
    expect(p!.entrada.itens[0].ncm).toBe("85081100");
  });

  it("PDF de outra ferramenta devolve null — não tentamos adivinhar", () => {
    const alheio = Buffer.from("%PDF-1.4\n/Title (Relatorio de outro sistema)\n%%EOF", "latin1");
    expect(extrairPayloadPdf(alheio)).toBeNull();
  });

  it("payload corrompido devolve null em vez de explodir", () => {
    const ruim = Buffer.from("%PDF-1.3\n/AliquoDados (não-é-base64-válido!!)\n%%EOF", "latin1");
    expect(extrairPayloadPdf(ruim)).toBeNull();
  });

  it("converte para o mesmo formato que a planilha produz", () => {
    const b64 = montarPayloadPdf({ resultado, entrada, apelido: "X" });
    const pdfFalso = Buffer.from(`/AliquoDados (${b64})`, "latin1");
    const e = payloadParaEmbarque(extrairPayloadPdf(pdfFalso)!, "X");

    expect(e.uf).toBe("SP");
    expect(e.frete).toBe(2400);
    expect(e.criterioRateio).toBe("peso");
    expect(e.itens[0]).toMatchObject({ ncm: "85081100", quantidade: 10, valorUnitario: 120 });
  });
});
