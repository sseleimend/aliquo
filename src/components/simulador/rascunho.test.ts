import { describe, expect, it } from "vitest";
import {
  novoItem,
  PASSOS,
  paraPayload,
  passoAcessivel,
  podeAvancar,
  rascunhoInicial,
  reducer,
  todosConfirmados,
  type Rascunho,
} from "./rascunho";

function confirmado(e: Rascunho, indice = 0): Rascunho {
  return reducer(e, {
    tipo: "item.confirmarNcm",
    indice,
    ncm: "85081100",
    ncmFmt: "8508.11.00",
    descricaoOficial: "-- De potência não superior a 1.500 W",
    caminhoOficial: "Aspiradores. > Com motor elétrico incorporado",
    fonte: "ia_confirmada",
    confianca: 0.9,
  });
}

function comValor(e: Rascunho, indice = 0): Rascunho {
  return reducer(e, {
    tipo: "item.campo",
    indice,
    campo: "valorUnitarioMoeda",
    valor: "1000",
  });
}

describe("transições do rascunho", () => {
  it("não avança do passo de NCM sem confirmação explícita (RF-A3)", () => {
    let e = rascunhoInicial();
    e = reducer(e, { tipo: "item.campo", indice: 0, campo: "descricaoProduto", valor: "robô aspirador" });
    e = reducer(e, { tipo: "avancar" }); // -> passo 1 (confirmar NCM)

    expect(e.passo).toBe(1);
    expect(podeAvancar(e)).toBe(false);

    e = confirmado(e);
    expect(podeAvancar(e)).toBe(true);
  });

  it("não permite pular direto para os passos de valor sem NCM confirmada", () => {
    const e = rascunhoInicial();
    expect(passoAcessivel(e, 1)).toBe(true);
    expect(passoAcessivel(e, 2)).toBe(false);
    expect(passoAcessivel(e, 5)).toBe(false);

    const ok = confirmado(e);
    expect(passoAcessivel(ok, 2)).toBe(true);
  });

  it("exige valor e quantidade antes de seguir para frete", () => {
    let e = confirmado(rascunhoInicial());
    e = reducer(e, { tipo: "passo", passo: 2 });
    expect(podeAvancar(e)).toBe(false);

    e = comValor(e);
    expect(podeAvancar(e)).toBe(true);
  });

  it("todos os itens precisam estar confirmados, não só o primeiro", () => {
    let e = confirmado(rascunhoInicial());
    e = reducer(e, { tipo: "item.add" });
    expect(todosConfirmados(e)).toBe(false);

    e = confirmado(e, 1);
    expect(todosConfirmados(e)).toBe(true);
  });

  it("remover item mantém ao menos um e reposiciona o ativo", () => {
    let e = reducer(rascunhoInicial(), { tipo: "item.add" });
    expect(e.itens).toHaveLength(2);
    expect(e.itemAtivo).toBe(1);

    e = reducer(e, { tipo: "item.remove", indice: 1 });
    expect(e.itens).toHaveLength(1);
    expect(e.itemAtivo).toBe(0);

    e = reducer(e, { tipo: "item.remove", indice: 0 });
    expect(e.itens).toHaveLength(1); // nunca fica sem item
  });

  it("trocar de modo preserva todo o estado — é um fluxo só, com dois ritmos", () => {
    let e = comValor(confirmado(rascunhoInicial("guiado")));
    e = reducer(e, { tipo: "passo", passo: 3 });
    const antes = { ...e };

    e = reducer(e, { tipo: "modo", modo: "rapido" });

    expect(e.modo).toBe("rapido");
    expect(e.passo).toBe(antes.passo);
    expect(e.itens).toEqual(antes.itens);
  });

  it("reusar do histórico parte do rascunho vazio e destrava os passos de valor", () => {
    // Regressão: o reuso vivia só no passo de valores, que exige NCM
    // confirmada — obrigando a classificar à mão justamente o que a importação
    // anterior já traz. O reuso precisa funcionar a partir do rascunho vazio.
    const vazio = rascunhoInicial();
    expect(todosConfirmados(vazio)).toBe(false);
    expect(passoAcessivel(vazio, 2)).toBe(false);

    const reusado = reducer(vazio, {
      tipo: "carregar",
      duplicadaDeId: "imp-antiga",
      rascunho: {
        invoiceId: "inv-1", // a fatura anexada acompanha o reuso
        moeda: "USD",
        passo: 1,
        itens: [
          novoItem({
            ncm: "85081100",
            ncmFmt: "8508.11.00",
            ncmFonte: "reuso",
            confirmado: true,
            descricaoProduto: "Robô aspirador 60 W",
            quantidade: "10",
            valorUnitarioMoeda: "120",
          }),
        ],
      },
    });

    expect(todosConfirmados(reusado)).toBe(true);
    expect(passoAcessivel(reusado, 2)).toBe(true);
    expect(reusado.duplicadaDeId).toBe("imp-antiga");
    expect(reusado.invoiceId).toBe("inv-1");
    // Valores já vêm preenchidos, então o passo de valores está satisfeito.
    expect(podeAvancar(reducer(reusado, { tipo: "passo", passo: 2 }))).toBe(true);
    expect(paraPayload(reusado).itens[0]).toMatchObject({
      ncm: "85081100",
      quantidade: 10,
      valorUnitarioMoeda: 120,
      ncmFonte: "reuso",
    });
    expect(paraPayload(reusado).invoiceId).toBe("inv-1");
  });

  it("carregar rascunho duplicado não traz resultado antigo junto", () => {
    let e = comValor(confirmado(rascunhoInicial()));
    e = reducer(e, {
      tipo: "resultado",
      importacaoId: "abc",
      resultado: { landedCost: 123 } as never,
    });
    expect(e.resultado).not.toBeNull();

    e = reducer(e, {
      tipo: "carregar",
      rascunho: { uf: "RJ", itens: [novoItem({ ncm: "85081100", confirmado: true })] },
      duplicadaDeId: "abc",
    });

    expect(e.resultado).toBeNull();
    expect(e.importacaoId).toBeNull();
    expect(e.duplicadaDeId).toBe("abc");
    expect(e.uf).toBe("RJ");
  });
});

describe("nova simulação limpa tudo", () => {
  it("reset devolve um rascunho vazio, sem sobras do anterior", () => {
    let e = comValor(confirmado(rascunhoInicial()));
    e = reducer(e, { tipo: "campo", campo: "freteInternacional", valor: "2400" });
    e = reducer(e, { tipo: "campo", campo: "thc", valor: "1150" });
    e = reducer(e, { tipo: "campo", campo: "invoiceId", valor: "inv-1" });
    e = reducer(e, { tipo: "campo", campo: "uf", valor: "RJ" });
    e = reducer(e, { tipo: "item.add" });

    const novo = reducer(e, { tipo: "reset" });

    expect(novo.itens).toHaveLength(1);
    expect(novo.itens[0].ncm).toBe("");
    expect(novo.itens[0].confirmado).toBe(false);
    expect(novo.itens[0].descricaoProduto).toBe("");
    expect(novo.freteInternacional).toBe("");
    expect(novo.thc).toBe("");
    expect(novo.invoiceId).toBeNull();
    expect(novo.uf).toBe("SP");
    expect(novo.passo).toBe(0);
    expect(novo.resultado).toBeNull();
    expect(novo.importacaoId).toBeNull();
    expect(novo.duplicadaDeId).toBeNull();
  });

  it("o modo escolhido sobrevive ao reset — é preferência, não dado da simulação", () => {
    const e = reducer(rascunhoInicial("rapido"), { tipo: "campo", campo: "thc", valor: "500" });
    expect(reducer(e, { tipo: "reset" }).modo).toBe("rapido");
  });
});

describe("payload enviado à API", () => {
  it("converte alíquotas manuais de porcentagem para fração", () => {
    let e = comValor(confirmado(rascunhoInicial()));
    e = reducer(e, { tipo: "item.campo", indice: 0, campo: "aliquotaIIManual", valor: "20" });

    const payload = paraPayload(e);
    expect(payload.itens[0].aliquotaIIManual).toBe(0.2);
    expect(payload.itens[0].aliquotaIPIManual).toBeUndefined();
  });

  it("aceita vírgula decimal como o usuário digita", () => {
    let e = confirmado(rascunhoInicial());
    e = reducer(e, { tipo: "item.campo", indice: 0, campo: "valorUnitarioMoeda", valor: "1234,56" });
    expect(paraPayload(e).itens[0].valorUnitarioMoeda).toBe(1234.56);
  });
});

describe("finalizar a simulação limpa os campos", () => {
  it("zera as entradas mas mantém o resultado na tela", () => {
    let e = comValor(confirmado(rascunhoInicial()));
    e = reducer(e, { tipo: "campo", campo: "freteInternacional", valor: "2400" });
    e = reducer(e, { tipo: "campo", campo: "thc", valor: "1150" });
    e = reducer(e, { tipo: "campo", campo: "invoiceId", valor: "inv-1" });
    e = reducer(e, { tipo: "campo", campo: "criterioRateio", valor: "peso" });

    const fim = reducer(e, {
      tipo: "resultado",
      importacaoId: "imp-1",
      resultado: { landedCost: 999 } as never,
    });

    // O resultado fica — é dele que sai o PDF.
    expect(fim.resultado).not.toBeNull();
    expect(fim.importacaoId).toBe("imp-1");
    expect(fim.passo).toBe(PASSOS.length - 1);

    // Tudo que era entrada foi zerado.
    expect(fim.freteInternacional).toBe("");
    expect(fim.thc).toBe("");
    expect(fim.invoiceId).toBeNull();
    expect(fim.criterioRateio).toBe("valor");
    expect(fim.itens).toHaveLength(1);
    expect(fim.itens[0].ncm).toBe("");
    expect(fim.itens[0].confirmado).toBe(false);
  });

  it("o modo de uso sobrevive ao encerramento", () => {
    const e = comValor(confirmado(rascunhoInicial("rapido")));
    const fim = reducer(e, {
      tipo: "resultado",
      importacaoId: "imp-1",
      resultado: {} as never,
    });
    expect(fim.modo).toBe("rapido");
  });
});
