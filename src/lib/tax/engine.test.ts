import { describe, expect, it } from "vitest";
import { calcularTributos, round2, sugestaoThc } from "@/lib/tax/engine";
import type { TaxInput } from "@/lib/tax/types";

function baseInput(over: Partial<TaxInput> = {}): TaxInput {
  return {
    ncm: "8544.42.00", // cabo: II 14,4% | IPI 10% | PIS 2,1% | COFINS 9,65%
    fobMoeda: 1000,
    moeda: "USD",
    taxaCambio: 5.0,
    uf: "SP", // ICMS 18%
    freteInternacional: 500,
    seguroInternacional: 100,
    thc: 0,
    armazenagem: 0,
    despachante: 0,
    siscomex: 200,
    afrmm: 0,
    outrosCustos: 0,
    ...over,
  };
}

describe("calcularTributos — caso conhecido (NCM 8544.42.00, SP)", () => {
  const r = calcularTributos(baseInput());

  it("converte o FOB e monta o valor aduaneiro (mercadoria + frete + seguro)", () => {
    expect(r.fobBrl).toBe(5000); // 1000 * 5
    expect(r.valorAduaneiro).toBe(5600); // 5000 + 500 + 100
  });

  it("calcula II sobre o valor aduaneiro", () => {
    const ii = r.tributos.find((t) => t.chave === "ii")!;
    expect(ii.valor).toBe(806.4); // 0.144 * 5600
  });

  it("calcula IPI sobre (valor aduaneiro + II)", () => {
    const ipi = r.tributos.find((t) => t.chave === "ipi")!;
    expect(ipi.valor).toBe(640.64); // 0.10 * (5600 + 806.4)
  });

  it("calcula PIS e COFINS sobre o valor aduaneiro", () => {
    expect(r.tributos.find((t) => t.chave === "pis")!.valor).toBe(117.6); // 0.021 * 5600
    expect(r.tributos.find((t) => t.chave === "cofins")!.valor).toBe(540.4); // 0.0965 * 5600
  });

  it("calcula a CBS de teste (0,9%) sobre o valor aduaneiro", () => {
    expect(r.tributos.find((t) => t.chave === "cbs")!.valor).toBe(50.4); // 0.009 * 5600
  });

  it("calcula o ICMS por dentro incluindo Siscomex na base", () => {
    const icms = r.tributos.find((t) => t.chave === "icms")!;
    // base parcial = 5600 + 806.4 + 640.64 + 117.6 + 540.4 + 200 = 7905.04
    // base cheia   = 7905.04 / (1 - 0.18) = 9640.29
    // icms         = base cheia * 0.18 = 1735.25
    expect(icms.base).toBe(9640.29);
    expect(icms.valor).toBe(1735.25);
  });

  it("soma tributos, custos e landed cost corretamente", () => {
    expect(r.totalTributos).toBe(3890.69);
    expect(r.totalCustos).toBe(200); // apenas Siscomex (frete/seguro estão no VA)
    expect(r.landedCost).toBe(9690.69); // 5600 + 3890.69 + 200
  });

  it("não gera aviso de NCM fora da base para um NCM conhecido", () => {
    expect(r.avisos).toHaveLength(0);
  });
});

describe("calcularTributos — NCM fora da base de amostra", () => {
  it("usa alíquotas federais padrão e sinaliza aviso", () => {
    const r = calcularTributos(baseInput({ ncm: "0101.21.00" }));
    expect(r.aliquotas.ii).toBe(0.16); // DEFAULT_FEDERAL_RATES
    expect(r.avisos.some((a) => a.includes("fora da base"))).toBe(true);
  });
});

describe("helpers", () => {
  it("round2 arredonda para centavos", () => {
    expect(round2(1735.25268)).toBe(1735.25);
    expect(round2(0.005)).toBe(0.01);
  });
  it("sugestaoThc retorna ~1% do valor", () => {
    expect(sugestaoThc(5000)).toBe(50);
  });
});
