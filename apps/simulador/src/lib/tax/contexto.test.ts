import { describe, expect, it } from "vitest";
import { resolverContexto } from "./contexto";
import { calcular } from "./engine";
import type { EntradaCalculo } from "./types";

/**
 * Testes de DADOS: rodam contra a base oficial carregada no banco
 * (`npm run base:import`). Provam que as alíquotas que chegam ao cálculo são
 * as publicadas, e não valores de amostra.
 */

describe("contexto a partir da base oficial", () => {
  it("resolve o robô aspirador (8508.11.00) com II e IPI oficiais", async () => {
    const ctx = await resolverContexto({ ncms: ["8508.11.00"], uf: "SP" });
    const a = ctx.porNcm["85081100"];

    expect(a.existeNaBase).toBe(true);
    expect(a.caminhoOficial).toMatch(/Aspiradores/i);
    // Os números da TEC e da TIPI vigentes.
    expect(a.ii).toMatchObject({ conhecida: true, valor: 0.2 });
    expect(a.ipi).toMatchObject({ conhecida: true, valor: 0.065 });
    // Rastreabilidade (RNF-1): toda alíquota carrega o ato que a fixou.
    if (a.ii.conhecida) expect(a.ii.ato).toBeTruthy();
    expect(ctx.baseAto).toMatch(/Gecex/i);
  }, 30_000);

  it("NCM inexistente não recebe alíquota inventada", async () => {
    const ctx = await resolverContexto({ ncms: ["9999.99.99"], uf: "SP" });
    const a = ctx.porNcm["99999999"];

    expect(a.existeNaBase).toBe(false);
    expect(a.ii.conhecida).toBe(false);
    expect(a.ipi.conhecida).toBe(false);
  }, 30_000);

  it("calcula o caso do PRD ponta a ponta com dados oficiais", async () => {
    const ctx = await resolverContexto({ ncms: ["8508.11.00"], uf: "SP" });

    const entrada: EntradaCalculo = {
      moeda: "USD",
      taxaCambio: 5,
      uf: "SP",
      itens: [{ ncm: "85081100", quantidade: 1, valorUnitarioMoeda: 1000 }],
      custos: [
        {
          chave: "frete",
          rotulo: "Frete internacional",
          valor: 500,
          compoeValorAduaneiro: true,
          entraBaseIcms: false,
          criterioRateio: "valor",
        },
      ],
    };

    const r = calcular(entrada, ctx);
    const ii = r.itens[0].tributos.find((t) => t.chave === "ii")!;
    const ipi = r.itens[0].tributos.find((t) => t.chave === "ipi")!;

    expect(r.provisorio).toBe(false);
    expect(r.bloqueios).toHaveLength(0);
    expect(r.itens[0].valorAduaneiro).toBe(5500);
    // II 20% sobre 5500.
    expect(ii.valor).toBe(1100);
    // IPI 6,5% sobre (5500 + 1100).
    expect(ipi.base).toBe(6600);
    expect(ipi.valor).toBe(429);
    expect(r.landedCost).toBeGreaterThan(r.itens[0].valorAduaneiro);
  }, 30_000);

  it("uma NCM sem UF não determina ICMS e o resultado fica provisório", async () => {
    const ctx = await resolverContexto({ ncms: ["8508.11.00"], uf: "" });
    const entrada: EntradaCalculo = {
      moeda: "USD",
      taxaCambio: 5,
      uf: "",
      itens: [{ ncm: "85081100", quantidade: 1, valorUnitarioMoeda: 100 }],
      custos: [],
    };
    const r = calcular(entrada, ctx);
    expect(r.provisorio).toBe(true);
    expect(r.bloqueios.some((b) => b.campo === "icms")).toBe(true);
  }, 30_000);
});
