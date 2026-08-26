import { describe, expect, it } from "vitest";
import { calcularIndicadores, type ImportacaoResumida } from "./indicadores";

/**
 * O que estes testes protegem não é a soma — é a regra de que valor não
 * confiável fica fora do número em destaque, e que o que ficou de fora é dito.
 */

const conferida = (landedCost: number): ImportacaoResumida => ({ landedCost, provisorio: false });
const provisoria = (landedCost: number): ImportacaoResumida => ({ landedCost, provisorio: true });

describe("indicadores do histórico", () => {
  it("histórico vazio não inventa número", () => {
    const i = calcularIndicadores([]);
    expect(i).toMatchObject({ total: 0, conferidas: 0, provisorias: 0, custoAcumulado: 0 });
    expect(i.alerta).toBe(false);
  });

  it("sem provisórias, o acumulado é a soma de tudo", () => {
    const i = calcularIndicadores([conferida(33034.27), conferida(33034.27)]);
    expect(i.custoAcumulado).toBeCloseTo(66068.54, 2);
    expect(i.notaCusto).toBe("2 importações");
    expect(i.notaProvisorias).toBe("todas conferidas");
    expect(i.alerta).toBe(false);
  });

  it("provisória fica FORA do acumulado", () => {
    const i = calcularIndicadores([
      conferida(33034.27),
      conferida(33034.27),
      provisoria(12394.45),
    ]);
    // Somar as três daria 78.462,99 — um destaque impossível de justificar.
    expect(i.custoAcumulado).toBeCloseTo(66068.54, 2);
    expect(i.custoProvisorio).toBeCloseTo(12394.45, 2);
    expect(i.total).toBe(3);
    expect(i.conferidas).toBe(2);
    expect(i.provisorias).toBe(1);
  });

  it("o valor excluído é dito, não sumido", () => {
    const i = calcularIndicadores([conferida(1000), provisoria(500)]);
    // Sem isso o acumulado deixa de bater com a tabela logo abaixo.
    expect(i.notaCusto).toContain("500,00");
    expect(i.notaCusto).toContain("fora da conta");
    expect(i.notaProvisorias).toBe("faltam alíquotas oficiais");
    expect(i.alerta).toBe(true);
  });

  it("histórico só de provisórias mostra zero acumulado, não o total delas", () => {
    const i = calcularIndicadores([provisoria(9000), provisoria(1000)]);
    expect(i.custoAcumulado).toBe(0);
    expect(i.custoProvisorio).toBeCloseTo(10000, 2);
    expect(i.conferidas).toBe(0);
    expect(i.alerta).toBe(true);
  });

  it("concorda o singular quando sobra uma conferida", () => {
    expect(calcularIndicadores([conferida(10)]).notaCusto).toBe("1 importação");
  });

  it("landedCost corrompido não contamina a soma com NaN", () => {
    const i = calcularIndicadores([
      conferida(100),
      { landedCost: Number.NaN, provisorio: false },
      { landedCost: Number.POSITIVE_INFINITY, provisorio: false },
    ]);
    expect(i.custoAcumulado).toBe(100);
  });
});
