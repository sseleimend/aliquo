import { afterEach, describe, expect, it } from "vitest";
import {
  _limparCachePrecos,
  custoUsdDaChamada,
  precoDe,
  ratearAssinatura,
  usdParaCentavosBrl,
} from "./custo";

function configurar(json: string | undefined) {
  if (json === undefined) delete process.env.LLM_PRECOS;
  else process.env.LLM_PRECOS = json;
  _limparCachePrecos();
}

afterEach(() => configurar(undefined));

describe("resolução de preço", () => {
  it("encontra por modelo exato e por nome do provider", () => {
    configurar(
      JSON.stringify({
        "claude-sonnet-5": { entradaUsdMilhao: 3, saidaUsdMilhao: 15 },
        gemini: { entradaUsdMilhao: 0.3, saidaUsdMilhao: 2.5 },
      }),
    );
    expect(precoDe("anthropic", "claude-sonnet-5")).toEqual({
      tipo: "porToken",
      entradaUsdPorMilhao: 3,
      saidaUsdPorMilhao: 15,
    });
    // Sem entrada para o modelo, cai no provider.
    expect(precoDe("gemini", "gemini-flash-latest").tipo).toBe("porToken");
  });

  it("reconhece cobrança por assinatura", () => {
    configurar(JSON.stringify({ "gpt-oss:120b": { assinaturaUsdMes: 20 } }));
    expect(precoDe("ollama", "gpt-oss:120b")).toEqual({
      tipo: "assinatura",
      mensalidadeUsd: 20,
    });
  });

  it("sem configuração, o preço é DESCONHECIDO — não zero", () => {
    configurar(undefined);
    expect(precoDe("ollama", "gpt-oss:120b").tipo).toBe("naoConfigurado");
  });

  it("JSON inválido não derruba nada", () => {
    configurar("{isso nao e json");
    expect(precoDe("x", "y").tipo).toBe("naoConfigurado");
  });

  it("entrada incompleta é tratada como não configurada", () => {
    configurar(JSON.stringify({ x: { entradaUsdMilhao: 3 } })); // falta saída
    expect(precoDe("x", "x").tipo).toBe("naoConfigurado");
  });
});

describe("custo da chamada", () => {
  it("calcula por token", () => {
    const preco = { tipo: "porToken", entradaUsdPorMilhao: 3, saidaUsdPorMilhao: 15 } as const;
    // 1M de entrada + 1M de saída = 3 + 15
    expect(custoUsdDaChamada(preco, 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
    // Os números reais da chamada que medi no teste manual.
    expect(custoUsdDaChamada(preco, 3783, 393)).toBeCloseTo(0.011349 + 0.005895, 6);
  });

  it("assinatura não tem custo por chamada — é null, não zero", () => {
    expect(custoUsdDaChamada({ tipo: "assinatura", mensalidadeUsd: 20 }, 1000, 100)).toBeNull();
  });

  it("sem preço configurado, custo é null", () => {
    expect(custoUsdDaChamada({ tipo: "naoConfigurado" }, 1000, 100)).toBeNull();
  });

  it("sem tokens medidos, custo é null", () => {
    const preco = { tipo: "porToken", entradaUsdPorMilhao: 3, saidaUsdPorMilhao: 15 } as const;
    expect(custoUsdDaChamada(preco, undefined, undefined)).toBeNull();
  });
});

describe("conversão e rateio", () => {
  it("converte USD para centavos de BRL arredondando para cima", () => {
    // Custo nunca deve ser subestimado por arredondamento.
    expect(usdParaCentavosBrl(1, 5.2)).toBe(520);
    expect(usdParaCentavosBrl(0.0001, 5.2)).toBe(1);
  });

  it("rateia a mensalidade pelo volume do mês", () => {
    // US$ 20 / 100 chamadas = US$ 0,20 -> R$ 1,04 a R$ 5,20/USD
    expect(ratearAssinatura(20, 100, 5.2)).toBe(104);
    // Quanto mais uso, menor o custo unitário — é o ponto da assinatura.
    expect(ratearAssinatura(20, 1000, 5.2)).toBe(11);
  });

  it("sem chamadas no mês não há rateio possível", () => {
    expect(ratearAssinatura(20, 0, 5.2)).toBeNull();
  });
});
