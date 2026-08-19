import { describe, expect, it } from "vitest";
import { calcular, round2, sugestaoThc } from "./engine";
import { ratear } from "./rateio";
import { BR_2026_ATUAL } from "./rulesets/br-2026-atual";
import type { ContextoCalculo, EntradaCalculo } from "./types";

/**
 * Dois níveis de teste, deliberadamente separados:
 *
 *   MECÂNICA — alíquotas INJETADAS. Prova a matemática do motor (ordem das
 *   bases, gross-up do ICMS, rateio, arredondamento) de forma independente de
 *   qualquer base oficial. Os onze números dourados da Fase 1 vivem aqui.
 *
 *   DADOS    — alíquotas OFICIAIS vindas do banco. Vive em contexto.test.ts,
 *   porque depende da base carregada.
 *
 * Os valores dourados usam II 14,4% / IPI 10%, que eram as alíquotas de
 * amostra do protótipo. A NCM real 8544.42.00 tem II 16% / IPI 5% na TEC/TIPI
 * vigentes — ou seja, aqueles números NUNCA descreveram a realidade fiscal.
 * Mantê-los aqui como contrato de MECÂNICA preserva a regressão do motor sem
 * fingir que eram corretos.
 */

function ctxDeTeste(over: Partial<ContextoCalculo> = {}): ContextoCalculo {
  return {
    rulesetId: BR_2026_ATUAL.id,
    rulesetRotulo: BR_2026_ATUAL.rotulo,
    dataReferencia: "2026-06-01T00:00:00.000Z",
    regime: "lucro_real",
    uf: "SP",
    icms: { conhecida: true, valor: 0.18, fonte: "teste" },
    porNcm: {
      "85444200": {
        ncm: "85444200",
        descricaoOficial: "Cabos para teste",
        caminhoOficial: "Capítulo 85 > Cabos > Para teste",
        existeNaBase: true,
        ii: { conhecida: true, valor: 0.144, fonte: "teste" },
        ipi: { conhecida: true, valor: 0.1, fonte: "teste" },
        pis: { conhecida: true, valor: 0.021, fonte: "teste" },
        cofins: { conhecida: true, valor: 0.0965, fonte: "teste" },
      },
    },
    ...over,
  };
}

function entradaBase(): EntradaCalculo {
  return {
    moeda: "USD",
    taxaCambio: 5,
    uf: "SP",
    itens: [{ ncm: "85444200", quantidade: 1, valorUnitarioMoeda: 1000 }],
    custos: [
      {
        chave: "frete",
        rotulo: "Frete internacional",
        valor: 500,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "valor",
      },
      {
        chave: "seguro",
        rotulo: "Seguro internacional",
        valor: 100,
        compoeValorAduaneiro: true,
        entraBaseIcms: false,
        criterioRateio: "valor",
      },
      {
        chave: "siscomex",
        rotulo: "Taxa Siscomex",
        valor: 200,
        compoeValorAduaneiro: false,
        entraBaseIcms: true,
        criterioRateio: "valor",
      },
    ],
  };
}

describe("mecânica do motor — contrato de regressão", () => {
  const r = calcular(entradaBase(), ctxDeTeste());
  const item = r.itens[0];
  const t = (chave: string) => item.tributos.find((x) => x.chave === chave)!;

  it("valor aduaneiro = FOB convertido + frete + seguro", () => {
    expect(item.fobBrl).toBe(5000);
    expect(item.valorAduaneiro).toBe(5600);
  });

  it("II incide sobre o valor aduaneiro", () => {
    expect(t("ii").valor).toBe(806.4);
  });

  it("IPI incide sobre valor aduaneiro + II", () => {
    expect(t("ipi").base).toBe(6406.4);
    expect(t("ipi").valor).toBe(640.64);
  });

  it("PIS e COFINS incidem sobre o valor aduaneiro", () => {
    expect(t("pis").valor).toBe(117.6);
    expect(t("cofins").valor).toBe(540.4);
  });

  it("CBS de teste incide sobre o valor aduaneiro", () => {
    expect(t("cbs").valor).toBe(50.4);
  });

  it("ICMS é calculado por dentro e inclui Siscomex na base", () => {
    expect(t("icms").base).toBe(9640.29);
    expect(t("icms").valor).toBe(1735.25);
  });

  it("CBS não integra a base do ICMS", () => {
    const semCbs = 5600 + 806.4 + 640.64 + 117.6 + 540.4 + 200;
    expect(round2(t("icms").base * (1 - 0.18))).toBe(round2(semCbs));
  });

  it("totais fecham no landed cost", () => {
    expect(r.totalTributos).toBe(3890.69);
    expect(r.totalCustos).toBe(200);
    expect(r.landedCost).toBe(9690.69);
  });

  it("frete e seguro não são contados duas vezes", () => {
    // Já estão dentro do valor aduaneiro; não podem reaparecer nos custos.
    expect(item.custosRateados.map((c) => c.chave)).toEqual(["siscomex"]);
  });

  it("helpers", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(sugestaoThc(10000)).toBe(100);
  });
});

describe("bloqueio quando falta alíquota oficial", () => {
  it("não produz custo total e marca a simulação como provisória", () => {
    const ctx = ctxDeTeste({
      porNcm: {
        "99999999": {
          ncm: "99999999",
          existeNaBase: true,
          ii: { conhecida: false, motivo: "sem II na TEC" },
          ipi: { conhecida: false, motivo: "sem IPI na TIPI" },
          pis: { conhecida: true, valor: 0.021, fonte: "lei" },
          cofins: { conhecida: true, valor: 0.0965, fonte: "lei" },
        },
      },
    });
    const entrada = entradaBase();
    entrada.itens = [{ ncm: "99999999", quantidade: 1, valorUnitarioMoeda: 1000 }];

    const r = calcular(entrada, ctx);

    expect(r.provisorio).toBe(true);
    expect(r.bloqueios.map((b) => b.campo).sort()).toEqual(["ii", "ipi"]);
    expect(r.bloqueios.every((b) => b.permiteEntradaManual)).toBe(true);
    // Nenhuma alíquota inventada: II e IPI simplesmente não foram cobrados.
    expect(r.itens[0].tributos.find((t) => t.chave === "ii")).toBeUndefined();
    expect(r.avisos.join(" ")).toMatch(/PROVIS[ÓO]RIA/i);
  });

  it("NCM ausente da base bloqueia sem permitir entrada manual do código", () => {
    const ctx = ctxDeTeste({ porNcm: {} });
    const entrada = entradaBase();
    entrada.itens = [{ ncm: "12345678", quantidade: 1, valorUnitarioMoeda: 100 }];

    const r = calcular(entrada, ctx);
    expect(r.bloqueios.some((b) => b.campo === "ncm" && !b.permiteEntradaManual)).toBe(true);
  });

  it("alíquota informada manualmente destrava o cálculo e fica registrada", () => {
    const ctx = ctxDeTeste({
      porNcm: {
        "99999999": {
          ncm: "99999999",
          existeNaBase: true,
          ii: { conhecida: false, motivo: "sem II" },
          ipi: { conhecida: true, valor: 0, fonte: "TIPI" },
          pis: { conhecida: true, valor: 0.021, fonte: "lei" },
          cofins: { conhecida: true, valor: 0.0965, fonte: "lei" },
        },
      },
    });
    const entrada = entradaBase();
    entrada.itens = [
      { ncm: "99999999", quantidade: 1, valorUnitarioMoeda: 1000, aliquotaIIManual: 0.2 },
    ];

    const r = calcular(entrada, ctx);
    const ii = r.itens[0].tributos.find((t) => t.chave === "ii")!;
    expect(ii.aliquota).toBe(0.2);
    expect(ii.fonteAliquota).toMatch(/usu[áa]rio/i);
    expect(r.bloqueios.filter((b) => b.campo === "ii")).toHaveLength(0);
  });
});

describe("IPI não-tributado (NT) é diferente de 0%", () => {
  it("cobra zero mas declara a origem como NT", () => {
    const ctx = ctxDeTeste();
    ctx.porNcm["85444200"].ipi = {
      conhecida: true,
      valor: 0,
      naoTributado: true,
      fonte: "TIPI",
    };
    const r = calcular(entradaBase(), ctx);
    const ipi = r.itens[0].tributos.find((t) => t.chave === "ipi")!;
    expect(ipi.valor).toBe(0);
    expect(ipi.fonteAliquota).toMatch(/NT/);
  });
});

describe("rateio entre itens (RF-D1)", () => {
  it("distribui proporcionalmente ao valor e reconcilia centavos", () => {
    const partes = ratear(100, [1, 1, 1]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(partes).toEqual([33.34, 33.33, 33.33]);
  });

  it("divide igualmente quando não há base de rateio", () => {
    expect(ratear(10, [0, 0])).toEqual([5, 5]);
  });

  it("dois itens somam exatamente o total do embarque", () => {
    const entrada = entradaBase();
    entrada.itens = [
      { ncm: "85444200", quantidade: 1, valorUnitarioMoeda: 700 },
      { ncm: "85444200", quantidade: 1, valorUnitarioMoeda: 300 },
    ];

    const r = calcular(entrada, ctx2());
    const somaVa = round2(r.itens.reduce((s, i) => s + i.valorAduaneiro, 0));

    expect(r.itens).toHaveLength(2);
    expect(somaVa).toBe(r.valorAduaneiroTotal);
    expect(r.valorAduaneiroTotal).toBe(5600);

    // Rateio 70/30 do frete e do seguro, sem sobra.
    expect(r.itens[0].freteRateado).toBe(350);
    expect(r.itens[1].freteRateado).toBe(150);
    expect(round2(r.itens[0].seguroRateado + r.itens[1].seguroRateado)).toBe(100);

    // O mesmo embarque lançado em 2 itens pode diferir alguns centavos do
    // lançamento em 1 item, porque os tributos são arredondados por item —
    // que é como uma DI real apura, por adição. O que NÃO pode acontecer é
    // a diferença crescer: fica no nível do centavo.
    expect(Math.abs(r.landedCost - 9690.69)).toBeLessThanOrEqual(0.02);
  });

  it("os totais fecham com a soma das linhas exibidas em cada item", () => {
    const entrada = entradaBase();
    entrada.itens = [
      { ncm: "85444200", quantidade: 1, valorUnitarioMoeda: 700 },
      { ncm: "85444200", quantidade: 1, valorUnitarioMoeda: 300 },
    ];
    const r = calcular(entrada, ctx2());

    for (const item of r.itens) {
      const somaLinhas = round2(item.tributos.reduce((s, t) => s + t.valor, 0));
      expect(somaLinhas).toBe(item.totalTributos);
      expect(round2(item.valorAduaneiro + item.totalTributos + item.totalCustos)).toBe(
        item.landedCost,
      );
    }
    expect(round2(r.itens.reduce((s, i) => s + i.landedCost, 0))).toBe(r.landedCost);
  });

  function ctx2() {
    return ctxDeTeste();
  }
});

describe("regime tributário muda o custo efetivo (RF-B3)", () => {
  it("Simples Nacional recupera menos crédito que Lucro Real", () => {
    const real = calcular(entradaBase(), ctxDeTeste({ regime: "lucro_real" }));
    const simples = calcular(entradaBase(), ctxDeTeste({ regime: "simples_nacional" }));

    expect(real.landedCost).toBe(simples.landedCost); // desembolso igual
    expect(simples.landedCostEfetivo).toBeGreaterThan(real.landedCostEfetivo);
    expect(simples.creditosRecuperaveis).toHaveLength(0);
    expect(real.creditosRecuperaveis.length).toBeGreaterThan(0);
  });
});

describe("conjunto de regras é a fonte da estrutura (RF-B1)", () => {
  it("a base do IPI contém o II", () => {
    const ipi = BR_2026_ATUAL.tributos.find((t) => t.chave === "ipi")!;
    expect(ipi.base).toEqual({ tipo: "soma", componentes: ["valorAduaneiro", "ii"] });
  });

  it("a base do ICMS exclui a CBS e o ICMS é por dentro", () => {
    const icms = BR_2026_ATUAL.tributos.find((t) => t.chave === "icms")!;
    expect(icms.porDentro).toBe(true);
    expect(icms.base.tipo).toBe("soma");
    if (icms.base.tipo === "soma") expect(icms.base.componentes).not.toContain("cbs");
  });

  it("toda regra declara sua fonte legal (RNF-1)", () => {
    for (const t of BR_2026_ATUAL.tributos) {
      expect(t.fonteLegal.length).toBeGreaterThan(8);
    }
  });
});
