/**
 * Motor de cálculo tributário e de landed cost — NÚCLEO do produto.
 *
 * É um INTERPRETADOR de conjuntos de regras (RF-B1): não há fórmula fixa aqui.
 * As regras declaram base, alíquota e ordem; o motor as aplica acumulando um
 * contexto. Trocar o modelo tributário (IBS/CBS) é trocar o conjunto de regras.
 *
 * Duas propriedades deliberadas:
 *
 *   PURO E SÍNCRONO — nenhum acesso a banco ou rede. Tudo que ele precisa
 *   chega resolvido em `ContextoCalculo` (ver contexto.ts). Isso mantém o
 *   motor testável sem mock e torna o contexto um snapshot reproduzível.
 *
 *   NUNCA INVENTA ALÍQUOTA — se a base oficial não tem o número, o item sai
 *   BLOQUEADO e o resultado é marcado como provisório. Foi o "padrão silencioso"
 *   da Fase 1 que produziu um landed cost de R$ 9.228,48 sobre alíquotas
 *   fictícias; aqui isso é impossível por construção.
 */

import { getRuleSet } from "./rulesets";
import type {
  ChaveTributo,
  ComponenteBase,
  ContextoRegra,
  EspecBase,
  RegraTributo,
} from "./rulesets/tipos";
import { pesosPorCriterio, ratear, round2 } from "./rateio";
import type {
  Aliquota,
  Bloqueio,
  ContextoCalculo,
  EntradaCalculo,
  ItemCalculo,
  LinhaCusto,
  LinhaTributo,
  ResultadoCalculo,
  ResultadoItem,
} from "./types";

export { round2 };

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** THC sugerido como ≈1% do valor da carga — apenas referência. */
export function sugestaoThc(valorCargaBrl: number): number {
  return round2(valorCargaBrl * 0.01);
}

/** Resolve a alíquota de uma regra, considerando entrada manual do usuário. */
function resolverAliquota(
  regra: RegraTributo,
  ctx: ContextoCalculo,
  item: ItemCalculo,
): Aliquota {
  switch (regra.aliquota.tipo) {
    case "fixa":
      return { conhecida: true, valor: regra.aliquota.valor, fonte: "conjunto de regras" };
    case "porUf":
      return ctx.icms;
    case "porNcm": {
      const campo = regra.aliquota.campo;
      const manual =
        campo === "ii" ? item.aliquotaIIManual : campo === "ipi" ? item.aliquotaIPIManual : undefined;
      if (manual != null && Number.isFinite(manual)) {
        return { conhecida: true, valor: manual, fonte: "informada pelo usuário", manual: true };
      }
      const doNcm = ctx.porNcm[item.ncm];
      if (!doNcm) {
        return { conhecida: false, motivo: "NCM não encontrada na base oficial carregada" };
      }
      return doNcm[campo];
    }
  }
}

/** Soma os componentes de uma base já calculados para o item. */
function calcularBase(
  espec: EspecBase,
  valorAduaneiro: number,
  despesasAduaneiras: number,
  jaCalculados: Map<ChaveTributo, number>,
): number {
  if (espec.tipo === "valorAduaneiro") return valorAduaneiro;

  let soma = 0;
  for (const c of espec.componentes as ComponenteBase[]) {
    if (c === "valorAduaneiro") soma += valorAduaneiro;
    else if (c === "despesasAduaneiras") soma += despesasAduaneiras;
    else soma += jaCalculados.get(c) ?? 0;
  }
  return soma;
}

export function calcular(entrada: EntradaCalculo, ctx: ContextoCalculo): ResultadoCalculo {
  const ruleset = getRuleSet(ctx.rulesetId);
  const avisos: string[] = [];
  const bloqueiosGerais: Bloqueio[] = [];

  const ctxRegra: ContextoRegra = {
    regime: ctx.regime,
    uf: ctx.uf,
    dataReferencia: ctx.dataReferencia,
  };

  const itens = entrada.itens.filter(Boolean);
  if (itens.length === 0) {
    throw new Error("A importação precisa de ao menos um item.");
  }

  const taxaCambio = num(entrada.taxaCambio);

  // ---- 1. FOB por item ---------------------------------------------------
  const fobMoedaPorItem = itens.map((i) => num(i.valorUnitarioMoeda) * (num(i.quantidade) || 1));
  const fobBrlPorItem = fobMoedaPorItem.map((v) => v * taxaCambio);

  // ---- 2. Rateio dos custos ---------------------------------------------
  const custos = entrada.custos.filter((c) => c && num(c.valor) > 0);

  const rateados = custos.map((c) => ({
    custo: c,
    partes: ratear(num(c.valor), pesosPorCriterio(itens, c.criterioRateio, fobBrlPorItem)),
  }));

  const somaPor = (filtro: (c: (typeof custos)[number]) => boolean, idx: number) =>
    rateados.filter((r) => filtro(r.custo)).reduce((s, r) => s + (r.partes[idx] ?? 0), 0);

  // ---- 3. Cálculo por item ----------------------------------------------
  const resultadosItens: ResultadoItem[] = itens.map((item, idx) => {
    const bloqueios: Bloqueio[] = [];
    const fobBrl = fobBrlPorItem[idx];

    const frete = somaPor((c) => c.compoeValorAduaneiro && c.chave === "frete", idx);
    const seguro = somaPor((c) => c.compoeValorAduaneiro && c.chave === "seguro", idx);
    const outrosVa = somaPor(
      (c) => c.compoeValorAduaneiro && c.chave !== "frete" && c.chave !== "seguro",
      idx,
    );
    const despesasAduaneiras = somaPor((c) => c.entraBaseIcms && !c.compoeValorAduaneiro, idx);

    const valorAduaneiro = fobBrl + frete + seguro + outrosVa;

    const dadosNcm = ctx.porNcm[item.ncm];
    if (!dadosNcm?.existeNaBase) {
      bloqueios.push({
        item: idx,
        ncm: item.ncm,
        campo: "ncm",
        mensagem:
          "NCM não encontrada na base oficial carregada. Confirme o código ou atualize a base.",
        permiteEntradaManual: false,
      });
    }

    const calculados = new Map<ChaveTributo, number>();
    const linhas: LinhaTributo[] = [];

    const regras = [...ruleset.tributos]
      .filter((r) => !r.aplicavel || r.aplicavel(ctxRegra))
      .sort((a, b) => a.ordem - b.ordem);

    for (const regra of regras) {
      const aliq = resolverAliquota(regra, ctx, item);

      if (!aliq.conhecida) {
        bloqueios.push({
          item: idx,
          ncm: item.ncm,
          campo: regra.chave,
          mensagem: `${regra.rotulo}: ${aliq.motivo}. Informe a alíquota para prosseguir.`,
          permiteEntradaManual: regra.chave === "ii" || regra.chave === "ipi",
        });
        calculados.set(regra.chave, 0);
        continue;
      }

      const fator = regra.fatorTransicao ?? 1;
      const aliquota = aliq.naoTributado ? 0 : aliq.valor * fator;

      const baseParcial = calcularBase(regra.base, valorAduaneiro, despesasAduaneiras, calculados);
      const base = regra.porDentro && aliquota < 1 ? baseParcial / (1 - aliquota) : baseParcial;
      const valor = base * aliquota;

      calculados.set(regra.chave, valor);
      linhas.push({
        chave: regra.chave,
        rotulo:
          regra.chave === "icms" ? `${regra.rotulo} — ${ctx.uf || "UF?"}` : regra.rotulo,
        aliquota,
        base: round2(base),
        valor: round2(valor),
        esfera: regra.esfera,
        creditavel: regra.creditavel ? regra.creditavel(ctxRegra) : false,
        fonteLegal: regra.fonteLegal,
        fonteAliquota: aliq.fonte + (aliq.naoTributado ? " (NT — não-tributado)" : ""),
        observacao: regra.observacao,
      });
    }

    // Somamos os tributos já arredondados: cada linha é exibida ao usuário e
    // o total precisa bater com o que ele vê somando na tela.
    const totalTributos = linhas.reduce((s, l) => s + l.valor, 0);

    // Custos que NÃO compõem o valor aduaneiro entram no landed cost à parte
    // (frete e seguro já estão dentro do VA e não podem contar duas vezes).
    const custosRateados: LinhaCusto[] = rateados
      .filter((r) => !r.custo.compoeValorAduaneiro && (r.partes[idx] ?? 0) > 0)
      .map((r) => ({
        chave: r.custo.chave,
        rotulo: r.custo.rotulo,
        valor: round2(r.partes[idx] ?? 0),
        criterioRateio: itens.length > 1 ? r.custo.criterioRateio : undefined,
      }));
    const totalCustos = custosRateados.reduce((s, c) => s + c.valor, 0);

    const landedCost = valorAduaneiro + totalTributos + totalCustos;
    const creditos = linhas.filter((l) => l.creditavel).reduce((s, l) => s + l.valor, 0);

    return {
      ordem: idx,
      ncm: item.ncm,
      descricaoOficial: dadosNcm?.descricaoOficial,
      caminhoOficial: dadosNcm?.caminhoOficial,
      descricaoProduto: item.descricaoProduto,
      quantidade: num(item.quantidade) || 1,
      valorUnitarioMoeda: num(item.valorUnitarioMoeda),
      fobMoeda: round2(fobMoedaPorItem[idx]),
      fobBrl: round2(fobBrl),
      freteRateado: round2(frete),
      seguroRateado: round2(seguro),
      outrosVaRateado: round2(outrosVa),
      valorAduaneiro: round2(valorAduaneiro),
      despesasAduaneirasRateadas: round2(despesasAduaneiras),
      tributos: linhas,
      totalTributos: round2(totalTributos),
      custosRateados,
      totalCustos: round2(totalCustos),
      landedCost: round2(landedCost),
      landedCostEfetivo: round2(landedCost - creditos),
      bloqueios,
    };
  });

  // ---- 4. Consolidação ---------------------------------------------------
  // Somamos os valores JÁ ARREDONDADOS de cada item, de propósito: o usuário
  // confere o total somando o que vê na tela, e isso precisa fechar em todos
  // os níveis. O efeito colateral é que o mesmo embarque lançado em 2 itens
  // pode diferir alguns centavos do lançamento em 1 item — o que também é o
  // comportamento real de uma DI, onde os tributos são apurados por adição.
  const soma = (f: (r: ResultadoItem) => number) =>
    round2(resultadosItens.reduce((s, r) => s + f(r), 0));

  const totaisPorTributo = new Map<ChaveTributo, { rotulo: string; valor: number }>();
  const creditosPorTributo = new Map<ChaveTributo, { rotulo: string; valor: number }>();
  for (const r of resultadosItens) {
    for (const l of r.tributos) {
      const atual = totaisPorTributo.get(l.chave) ?? { rotulo: l.rotulo, valor: 0 };
      totaisPorTributo.set(l.chave, { rotulo: l.rotulo, valor: atual.valor + l.valor });
      if (l.creditavel) {
        const c = creditosPorTributo.get(l.chave) ?? { rotulo: l.rotulo, valor: 0 };
        creditosPorTributo.set(l.chave, { rotulo: l.rotulo, valor: c.valor + l.valor });
      }
    }
  }

  const bloqueios = [...bloqueiosGerais, ...resultadosItens.flatMap((r) => r.bloqueios)];
  const provisorio = bloqueios.length > 0;

  if (!ctx.uf) {
    avisos.push("UF de destino não informada — o ICMS não pôde ser determinado com precisão.");
  }
  if (ctx.fx?.stale) {
    avisos.push(
      `Câmbio obtido de cotação anterior (${ctx.fx.dataRef ?? "data desconhecida"}) — ` +
        "a fonte em tempo real não respondeu.",
    );
  }
  if (provisorio) {
    avisos.push(
      "SIMULAÇÃO PROVISÓRIA — falta alíquota oficial para ao menos um item. " +
        "O custo total só é confiável após informar ou confirmar as alíquotas pendentes.",
    );
  }

  return {
    rulesetId: ruleset.id,
    rulesetRotulo: ruleset.rotulo,
    dataReferencia: ctx.dataReferencia,
    regime: ctx.regime,
    uf: ctx.uf,
    moeda: entrada.moeda,
    taxaCambio,
    fx: ctx.fx,
    baseAto: ctx.baseAto,
    baseVigenteEm: ctx.baseVigenteEm,
    itens: resultadosItens,
    fobBrlTotal: soma((r) => r.fobBrl),
    valorAduaneiroTotal: soma((r) => r.valorAduaneiro),
    totalTributos: soma((r) => r.totalTributos),
    totalCustos: soma((r) => r.totalCustos),
    landedCost: soma((r) => r.landedCost),
    landedCostEfetivo: soma((r) => r.landedCostEfetivo),
    creditosRecuperaveis: [...creditosPorTributo.entries()].map(([chave, v]) => ({
      chave,
      rotulo: v.rotulo,
      valor: round2(v.valor),
    })),
    totaisPorTributo: [...totaisPorTributo.entries()].map(([chave, v]) => ({
      chave,
      rotulo: v.rotulo,
      valor: round2(v.valor),
    })),
    avisos,
    bloqueios,
    provisorio,
  };
}
