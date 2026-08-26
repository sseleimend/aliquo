import { describe, expect, it } from "vitest";
import { erroIcmsDeclarado, paraPayload, rascunhoInicial } from "@/components/simulador/rascunho";

/**
 * Entrada da alíquota declarada.
 *
 * O erro que originou estes testes chegou ao usuário como "Number must be less
 * than or equal to 0.35" — em inglês, sem nome de campo, e falando na fração
 * interna para quem tinha digitado em porcentagem. A unidade agora é uma só, e
 * o valor implausível é barrado no campo, não no servidor.
 */

const com = (over: Partial<ReturnType<typeof rascunhoInicial>>) => ({
  ...rascunhoInicial("guiado"),
  ...over,
});

describe("validação da alíquota declarada", () => {
  it("aceita a porcentagem como se digita", () => {
    expect(
      erroIcmsDeclarado(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "4" })),
    ).toBeNull();
  });

  it("aceita decimal com vírgula", () => {
    expect(
      erroIcmsDeclarado(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "4,5" })),
    ).toBeNull();
  });

  it("aceita carga efetiva abaixo de 1% — TTD chega lá", () => {
    expect(
      erroIcmsDeclarado(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "0,6" })),
    ).toBeNull();
  });

  it("barra o valor implausível antes de sair da tela", () => {
    const e = erroIcmsDeclarado(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "400" }));
    expect(e).toBeTruthy();
    // A mensagem tem que falar da unidade que a pessoa digitou.
    expect(e).toMatch(/porcentagem/i);
    expect(e).not.toMatch(/0\.35/);
  });

  it("cobra o preenchimento quando o regime é marcado e o campo fica vazio", () => {
    expect(
      erroIcmsDeclarado(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "" })),
    ).toBeTruthy();
  });

  it("não valida nada quando não há regime especial", () => {
    expect(erroIcmsDeclarado(com({ icmsAliquotaManual: "999" }))).toBeNull();
  });
});

describe("payload", () => {
  it("envia em porcentagem, não em fração — a unidade do servidor é a do campo", () => {
    const p = paraPayload(com({ icmsRegimeEspecial: true, icmsAliquotaManual: "4" }));
    expect(p.icmsAliquotaPercent).toBe(4);
  });

  it("omite o campo quando o regime especial está desmarcado", () => {
    const p = paraPayload(com({ icmsAliquotaManual: "4" }));
    expect(p.icmsAliquotaPercent).toBeUndefined();
  });
});
