import { afterEach, describe, expect, it, vi } from "vitest";
import { carregarDeDuplicata } from "./duplicar";
import { numero, rascunhoInicial, reducer, type AcaoRascunho, type Rascunho } from "./rascunho";

/**
 * Exercita o caminho completo do reuso no cliente: resposta da API ->
 * carregarDeDuplicata -> reducer. É onde os custos se perdiam.
 */

const respostaApi = {
  duplicadaDeId: "imp-antiga",
  aviso: "Os valores foram copiados...",
  rascunho: {
    apelido: "Robôs (cópia)",
    uf: "RJ",
    moeda: "USD",
    incoterm: "FOB",
    regimeTributario: "lucro_presumido",
    invoiceId: "inv-1",
    criterioRateio: "valor",
    itens: [
      {
        ncm: "85081100",
        descricaoProduto: "Robô aspirador 60 W",
        quantidade: 10,
        valorUnitarioMoeda: 120,
        ncmDescricaoOficial: "-- De potência não superior a 1.500 W",
        ncmCaminhoOficial: "Aspiradores. > Com motor elétrico incorporado",
      },
    ],
    freteInternacional: 2400,
    seguroInternacional: 90,
    siscomex: 214.5,
    afrmm: 0,
    thc: 1150,
    armazenagem: 0,
    despachante: 850,
    outrosCustos: 33,
  },
};

function aplicar(resposta: unknown) {
  let estado: Rascunho = rascunhoInicial();
  const despachar = (a: AcaoRascunho) => {
    estado = reducer(estado, a);
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => resposta })),
  );
  return { despachar, get: () => estado };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reuso a partir do histórico", () => {
  it("traz frete e seguro (passo 4)", async () => {
    const ctx = aplicar(respostaApi);
    const r = await carregarDeDuplicata("imp-antiga", ctx.despachar);
    expect(r.ok).toBe(true);

    const e = ctx.get();
    expect(numero(e.freteInternacional)).toBe(2400);
    expect(numero(e.seguroInternacional)).toBe(90);
  });

  it("traz os custos variáveis (passo 5)", async () => {
    const ctx = aplicar(respostaApi);
    await carregarDeDuplicata("imp-antiga", ctx.despachar);

    const e = ctx.get();
    expect(numero(e.siscomex)).toBe(214.5);
    expect(numero(e.thc)).toBe(1150);
    expect(numero(e.despachante)).toBe(850);
    expect(numero(e.outrosCustos)).toBe(33);
    // Custos ausentes na origem ficam vazios, não com lixo.
    expect(numero(e.afrmm)).toBe(0);
    expect(numero(e.armazenagem)).toBe(0);
  });

  it("traz o critério de rateio do embarque original", async () => {
    // Regressão: o critério não vinha, e um reuso rateado por peso voltava
    // silenciosamente para rateio por valor — mudando os tributos por item.
    const ctx = aplicar({
      ...respostaApi,
      rascunho: { ...respostaApi.rascunho, criterioRateio: "peso" },
    });
    await carregarDeDuplicata("imp-antiga", ctx.despachar);
    expect(ctx.get().criterioRateio).toBe("peso");
  });

  it("sem critério na resposta, assume o padrão em vez de ficar indefinido", async () => {
    const semCriterio = { ...respostaApi.rascunho } as Record<string, unknown>;
    delete semCriterio.criterioRateio;
    const ctx = aplicar({ ...respostaApi, rascunho: semCriterio });
    await carregarDeDuplicata("imp-antiga", ctx.despachar);
    expect(ctx.get().criterioRateio).toBe("valor");
  });

  it("traz cabeçalho, itens e a fatura anexada", async () => {
    const ctx = aplicar(respostaApi);
    await carregarDeDuplicata("imp-antiga", ctx.despachar);

    const e = ctx.get();
    expect(e.uf).toBe("RJ");
    expect(e.regimeTributario).toBe("lucro_presumido");
    expect(e.invoiceId).toBe("inv-1");
    expect(e.duplicadaDeId).toBe("imp-antiga");
    expect(e.itens).toHaveLength(1);
    expect(e.itens[0].confirmado).toBe(true);
    expect(e.itens[0].ncmCaminhoOficial).toMatch(/Aspiradores/);
    expect(numero(e.itens[0].valorUnitarioMoeda)).toBe(120);
  });

  it("não traz o resultado antigo junto", async () => {
    const ctx = aplicar(respostaApi);
    await carregarDeDuplicata("imp-antiga", ctx.despachar);
    expect(ctx.get().resultado).toBeNull();
    expect(ctx.get().importacaoId).toBeNull();
  });

  it("uma restauração tardia do localStorage não apaga os custos do reuso", async () => {
    // Regressão: o provider restaura o rascunho salvo no mount, e isso corria
    // contra o carregamento assíncrono do reuso. Quando a restauração chegava
    // depois, apagava frete, seguro e custos que o reuso tinha trazido.
    const ctx = aplicar(respostaApi);
    await carregarDeDuplicata("imp-antiga", ctx.despachar);
    expect(numero(ctx.get().freteInternacional)).toBe(2400);

    ctx.despachar({
      tipo: "restaurar",
      rascunho: { uf: "SP", freteInternacional: "", thc: "", siscomex: "" },
    });

    const e = ctx.get();
    expect(numero(e.freteInternacional)).toBe(2400);
    expect(numero(e.thc)).toBe(1150);
    expect(numero(e.siscomex)).toBe(214.5);
    expect(e.uf).toBe("RJ");
  });

  it("uma NCM já confirmada também bloqueia a restauração", () => {
    let estado = rascunhoInicial();
    estado = reducer(estado, {
      tipo: "item.confirmarNcm",
      indice: 0,
      ncm: "85081100",
      ncmFmt: "8508.11.00",
      fonte: "manual",
    });
    estado = reducer(estado, { tipo: "campo", campo: "thc", valor: "500" });

    const depois = reducer(estado, {
      tipo: "restaurar",
      rascunho: { thc: "", uf: "SP" },
    });
    expect(numero(depois.thc)).toBe(500);
    expect(depois.itens[0].ncm).toBe("85081100");
  });

  it("mas um rascunho intocado ainda é restaurado — a persistência continua útil", () => {
    const vazio = rascunhoInicial();
    const restaurado = reducer(vazio, {
      tipo: "restaurar",
      rascunho: { uf: "MG", freteInternacional: "999", thc: "111" },
    });
    expect(restaurado.uf).toBe("MG");
    expect(numero(restaurado.freteInternacional)).toBe(999);
    expect(numero(restaurado.thc)).toBe(111);
  });

  it("não restaura direto na tela de revisão vazia", () => {
    // O resultado não é persistido; cair na revisão sem número é um beco.
    const restaurado = reducer(rascunhoInicial(), {
      tipo: "restaurar",
      rascunho: { passo: 5, thc: "111" },
    });
    expect(restaurado.passo).toBe(4); // volta para os custos
    expect(numero(restaurado.thc)).toBe(111);
  });
});
