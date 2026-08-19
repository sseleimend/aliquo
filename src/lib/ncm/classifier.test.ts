import { describe, expect, it } from "vitest";
import { createScriptedProvider } from "@/lib/llm/scripted";
import { descobrirNcm, removerCodigos } from "./classifier";
import { extrairLimites, montarPergunta, prefixoComum } from "./desambiguacao";
import { montarExpressaoMatch } from "./retrieval";

// Estes testes rodam contra o banco real, que precisa ter a base oficial
// carregada (`npm run base:import`). É proposital: o invariante que importa —
// "nenhum código fora da base é apresentado" — só tem sentido contra a base.

const expansaoOk = JSON.stringify({
  reformulacao: "Robô aspirador doméstico com motor elétrico incorporado",
  termosBusca: ["aspirador", "limpeza doméstica"],
  termosEn: ["vacuum cleaner"],
  capitulos: ["85"],
});

describe("removerCodigos", () => {
  it("remove qualquer coisa parecida com NCM do texto da IA", () => {
    expect(removerCodigos("use o código 8509.40.00 aqui")).toBe("use o código aqui");
    expect(removerCodigos("codigo 85094000 solto")).toBe("codigo solto");
    expect(removerCodigos("aspirador de pó 1500 W")).toBe("aspirador de pó 1500 W");
  });
});

describe("montarExpressaoMatch", () => {
  it("usa prefixo a partir de 4 caracteres (FTS5 não faz stemming)", () => {
    expect(montarExpressaoMatch(["motor elétrico"])).toBe('"motor"* OR "eletrico"*');
  });

  it("descarta stopwords e termos curtos", () => {
    expect(montarExpressaoMatch(["de a o para com"])).toBe("");
  });

  it("neutraliza sintaxe do FTS5 vinda do usuário", () => {
    // Aspas, asteriscos e operadores não podem escapar para a consulta.
    const expr = montarExpressaoMatch(['aspirador" OR "x* NEAR(a b)']);
    expect(expr).not.toContain("NEAR");
    expect(expr.match(/"/g)?.length ?? 0).toBe(expr.split(" OR ").length * 2);
  });
});

describe("extrairLimites", () => {
  it("lê o limite numérico do texto oficial do 8508.11.00", () => {
    const limites = extrairLimites(
      "-- De potência não superior a 1.500 W e cujo volume do reservatório não exceda 20 l",
    );
    const grandezas = limites.map((l) => l.grandeza);
    expect(grandezas).toContain("potência");
    expect(grandezas).toContain("capacidade");
    expect(limites.find((l) => l.grandeza === "potência")?.valor).toBe("1.500");
    expect(limites.every((l) => l.comparador === "ate")).toBe(true);
  });

  it("não inventa limite onde não há", () => {
    expect(extrairLimites("-- Outros")).toEqual([]);
  });
});

describe("montarPergunta (RF-A2)", () => {
  it("pergunta sobre potência/capacidade no caso 8508.11 vs 8508.19", () => {
    const p = montarPergunta([
      {
        codigo: "85081100",
        descricao: "-- De potência não superior a 1.500 W e cujo volume do reservatório não exceda 20 l",
        caminho: "Aspiradores. > Com motor elétrico incorporado",
      },
      { codigo: "85081900", descricao: "-- Outros", caminho: "Aspiradores. > Com motor elétrico incorporado" },
    ]);

    expect(p).not.toBeNull();
    expect(p!.numerica).toBe(true);
    expect(p!.texto).toMatch(/potência/i);
    expect(p!.texto).toMatch(/1\.500 W/);
    // Cada opção precisa apontar para um candidato por índice.
    expect(p!.opcoes.map((o) => o.i).sort()).toEqual([0, 1]);
  });

  it("não pergunta quando há um único candidato", () => {
    expect(
      montarPergunta([{ codigo: "85081100", descricao: "-- Qualquer", caminho: "x" }]),
    ).toBeNull();
  });

  it("prefixoComum identifica irmãos pela subposição compartilhada", () => {
    expect(prefixoComum(["85081100", "85081900"])).toBe("85081");
    expect(prefixoComum(["85081100", "61091000"])).toBe("");
  });
});

describe("descobrirNcm — invariante de conjunto fechado (RF-A1)", () => {
  it("DESCARTA um código alucinado que não está no conjunto recuperado", async () => {
    // A IA tenta devolver o mesmo erro da Fase 1: 8509.40.00 com descrição
    // inventada. Como o contrato só aceita índices, o código não tem por onde
    // entrar — e um índice fora da faixa é ignorado.
    const provider = createScriptedProvider([
      expansaoOk,
      JSON.stringify({
        escolhas: [
          { i: 999, confianca: 0.99, porque: "indice invalido" },
          { i: -1, confianca: 0.9 },
          { i: "8509.40.00", confianca: 0.95 },
        ],
      }),
    ]);

    const r = await descobrirNcm(
      { descricao: "robô aspirador de pó, motor de 60 W, reservatório de 0,6 litro" },
      provider,
    );

    const codigos = (r.candidatos ?? []).map((c) => c.codigo);
    expect(codigos).not.toContain("85094000");
    expect(codigos.length).toBeGreaterThan(0);
    // Tudo que sobrou veio da base oficial.
    expect((r.candidatos ?? []).every((c) => c.fonte === "base")).toBe(true);
    expect((r.candidatos ?? []).every((c) => c.caminho.length > 0)).toBe(true);
  }, 30_000);

  it("encontra 8508.11.00 para o robô aspirador com atributos", async () => {
    const provider = createScriptedProvider([
      expansaoOk,
      JSON.stringify({ escolhas: [{ i: 0, confianca: 0.88, porque: "corresponde ao texto oficial" }] }),
    ]);

    const r = await descobrirNcm(
      { descricao: "robô aspirador de pó, motor de 60 W, reservatório de 0,6 litro" },
      provider,
    );

    expect(r.candidatos?.[0]?.codigo).toBe("85081100");
    expect(r.candidatos?.[0]?.caminho).toMatch(/Aspiradores/i);
  }, 30_000);

  it("degrada com aviso visível quando a IA falha — nunca em silêncio", async () => {
    const provider = createScriptedProvider(["__ERRO__", "__ERRO__"]);

    const r = await descobrirNcm({ descricao: "robô aspirador de pó" }, provider);

    expect(r.avisos.length).toBeGreaterThan(0);
    expect(r.avisos.join(" ")).toMatch(/IA/i);
    // Mesmo sem IA, os candidatos continuam vindo da base oficial.
    expect((r.candidatos ?? []).length).toBeGreaterThan(0);
    expect((r.candidatos ?? []).every((c) => c.fonte === "base")).toBe(true);
  }, 30_000);

  it("não usa rede com o provider mock e ainda assim classifica pela base", async () => {
    const { mockProvider } = await import("@/lib/llm/mock");
    const r = await descobrirNcm({ descricao: "cabo USB-C trançado 2 metros" }, mockProvider);

    expect(r.meta.usouIA).toBe(false);
    expect((r.candidatos ?? []).length).toBeGreaterThan(0);
    expect(r.candidatos?.some((c) => c.codigo.startsWith("8544"))).toBe(true);
  }, 30_000);
});
