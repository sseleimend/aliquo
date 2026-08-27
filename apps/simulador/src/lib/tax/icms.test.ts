import { describe, expect, it } from "vitest";
import { resolverContexto } from "./contexto";
import { getIcmsUfSync, totalIcms } from "./rates";

/**
 * ICMS: composição, adicional e declaração de regime especial (RF-B4).
 *
 * O que estes testes protegem é uma decisão, não uma fórmula: o número do
 * ICMS pode estar errado (não há tabela oficial consolidada dos 27 estados),
 * então ele nunca pode se apresentar como certo. Ou vem marcado como
 * estimativa, ou vem declarado pelo usuário — e a diferença tem que sobreviver
 * até o snapshot que vai para o histórico.
 */

describe("composição da alíquota", () => {
  it("separa alíquota interna do adicional de combate à pobreza", () => {
    const rj = getIcmsUfSync("RJ")!;
    // Os 22% que a tabela trazia sempre foram 20 + 2; agora dá para conferir.
    expect(rj.interna).toBe(0.2);
    expect(rj.fecp).toBe(0.02);
    expect(totalIcms(rj)).toBeCloseTo(0.22, 10);
  });

  it("permite excluir o adicional quando o produto está fora da lista do estado", () => {
    const rj = getIcmsUfSync("RJ")!;
    // É o ponto do conserto: o FECP incide sobre lista de produtos, e somar
    // cegamente cobrava 2 pontos a mais de quem está fora dela.
    expect(totalIcms(rj, false)).toBeCloseTo(0.2, 10);
  });

  it("não inventa adicional para estado sem FECP modelado", () => {
    const sp = getIcmsUfSync("SP")!;
    expect(sp.fecp).toBe(0);
    expect(totalIcms(sp, true)).toBeCloseTo(sp.interna, 10);
  });

  it("marca a tabela interna como estimativa", () => {
    expect(getIcmsUfSync("SP")!.estimativa).toBe(true);
    expect(getIcmsUfSync("SP")!.fonte).toMatch(/estimativa/i);
  });

  it("UF vazia não resolve — e não vira 18% por descuido", () => {
    expect(getIcmsUfSync("")).toBeNull();
  });
});

describe("contexto", () => {
  it("aplica o adicional por padrão onde o estado o cobra de forma geral", async () => {
    const ctx = await resolverContexto({ ncms: ["8508.11.00"], uf: "RJ" });
    expect(ctx.icms).toMatchObject({ conhecida: true, valor: 0.22 });
    expect(ctx.icmsDetalhe).toMatchObject({ interna: 0.2, fecp: 0.02, fecpAplicado: true });
    if (ctx.icms.conhecida) expect(ctx.icms.fonte).toMatch(/adicional \(FECP\)/i);
  }, 30_000);

  it("respeita a exclusão do adicional pelo usuário", async () => {
    const ctx = await resolverContexto({
      ncms: ["8508.11.00"],
      uf: "RJ",
      fecpAplicavel: false,
    });
    expect(ctx.icms).toMatchObject({ conhecida: true, valor: 0.2 });
    expect(ctx.icmsDetalhe?.fecpAplicado).toBe(false);
  }, 30_000);

  it("declaração de regime especial vence a tabela e fica identificada", async () => {
    const ctx = await resolverContexto({
      ncms: ["8508.11.00"],
      uf: "SC",
      icmsManual: 0.04,
      icmsObservacao: "TTD 409",
    });
    expect(ctx.icms).toMatchObject({ conhecida: true, valor: 0.04, manual: true });
    // Sem o rótulo, um 4% no meio de um documento fiscal parece dado oficial.
    if (ctx.icms.conhecida) {
      expect(ctx.icms.fonte).toMatch(/informada por você/i);
      expect(ctx.icms.fonte).toContain("TTD 409");
    }
    expect(ctx.icmsDetalhe).toMatchObject({ declarado: true, estimativa: false });
  }, 30_000);

  it("sem UF o ICMS fica desconhecido, não zero", async () => {
    const ctx = await resolverContexto({ ncms: ["8508.11.00"], uf: "" });
    expect(ctx.icms.conhecida).toBe(false);
  }, 30_000);
});
