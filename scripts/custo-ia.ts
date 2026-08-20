/**
 * Custo de IA por operação e por simulação (RNF-5).
 *
 * Fecha o que não dá para saber na hora da chamada: provider de assinatura
 * (Ollama Cloud) cobra mensalidade fixa, então o custo por simulação só existe
 * rateando a mensalidade pelo volume do mês — que só é conhecido agora.
 *
 * Uso: npm run custo:ia [AAAA-MM]
 */

import "./lib/env";
import { prisma } from "../src/lib/db";
import { precoDe, ratearAssinatura } from "../src/lib/llm/custo";
import { competenciaAtual } from "../src/lib/plans";
import { formatBRL } from "../src/lib/format";

function centavos(v: number | null): string {
  return v == null ? "—" : formatBRL(v / 100);
}

async function main() {
  const competencia = process.argv[2] ?? competenciaAtual();
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));

  console.log(`== Custo de IA — competência ${competencia} ==\n`);

  const eventos = await prisma.eventoUso.findMany({
    where: { createdAt: { gte: inicio, lt: fim } },
  });

  if (eventos.length === 0) {
    console.log("Nenhuma chamada de IA registrada nesta competência.");
    return;
  }

  const cotacao = await prisma.fxCotacao.findFirst({
    where: { moeda: "USD" },
    orderBy: { fetchedAt: "desc" },
  });
  if (!cotacao) {
    console.log("AVISO: nenhuma cotação de USD em cache — custos em BRL ficam pendentes.\n");
  }
  const taxa = cotacao?.rate ?? 0;

  // Agrupa por provider+modelo: cada combinação tem seu próprio modelo de cobrança.
  const grupos = new Map<
    string,
    { provider: string; model: string; chamadas: number; entrada: number; saida: number; jaCusteado: number }
  >();

  for (const e of eventos) {
    const chave = `${e.provider ?? "?"}|${e.model ?? "?"}`;
    const g = grupos.get(chave) ?? {
      provider: e.provider ?? "?",
      model: e.model ?? "?",
      chamadas: 0,
      entrada: 0,
      saida: 0,
      jaCusteado: 0,
    };
    g.chamadas += 1;
    g.entrada += e.inputTokens ?? 0;
    g.saida += e.outputTokens ?? 0;
    g.jaCusteado += e.custoEstimadoCentavos ?? 0;
    grupos.set(chave, g);
  }

  // Separar FIXO de VARIÁVEL é o ponto do relatório: assinatura não muda com
  // o volume, custo por token muda linearmente. Somar os dois e extrapolar
  // pelo teto do plano dá um número sem sentido.
  let fixoCentavos = 0;
  let variavelCentavos = 0;
  let algumDesconhecido = false;

  for (const g of grupos.values()) {
    if (g.provider === "?" && g.model === "?") {
      console.log(`(registros anteriores à medição de custo: ${g.chamadas} chamada(s) sem provider)`);
      console.log("");
      continue;
    }

    const preco = precoDe(g.provider, g.model);
    console.log(`${g.provider} · ${g.model}`);
    console.log(`  chamadas : ${g.chamadas}`);
    console.log(`  tokens   : ${g.entrada} entrada + ${g.saida} saída`);

    if (preco.tipo === "porToken") {
      console.log(`  cobrança : VARIÁVEL, por token (US$ ${preco.entradaUsdPorMilhao}/M entrada, US$ ${preco.saidaUsdPorMilhao}/M saída)`);
      console.log(`  custo    : ${centavos(g.jaCusteado)}`);
      variavelCentavos += g.jaCusteado;
    } else if (preco.tipo === "assinatura") {
      const porChamada = ratearAssinatura(preco.mensalidadeUsd, g.chamadas, taxa);
      // A mensalidade é o custo do mês inteiro, independente de quantas
      // chamadas houve — o rateio serve só para mostrar o unitário atual.
      const mensal = taxa > 0 ? Math.ceil(preco.mensalidadeUsd * taxa * 100) : null;
      console.log(`  cobrança : FIXA, assinatura (US$ ${preco.mensalidadeUsd}/mês)`);
      console.log(`  mensal   : ${centavos(mensal)}`);
      console.log(`  por call : ${centavos(porChamada)} (cai conforme o uso sobe)`);
      if (mensal != null) fixoCentavos += mensal;
      else algumDesconhecido = true;
    } else {
      console.log(`  cobrança : NÃO CONFIGURADA`);
      console.log(`  custo    : desconhecido — defina LLM_PRECOS para este modelo`);
      algumDesconhecido = true;
    }
    console.log("");
  }

  const totalCentavos = fixoCentavos + variavelCentavos;

  // Custo por SIMULAÇÃO, que é a unidade que importa para a margem do plano.
  const simulacoes = await prisma.usoMensal.aggregate({
    where: { competencia, tipo: "simulacao" },
    _sum: { total: true },
  });
  const nSim = simulacoes._sum.total ?? 0;

  console.log("--- RESUMO ---");
  console.log(`chamadas de IA : ${eventos.length}`);
  console.log(`simulações     : ${nSim}`);
  console.log(`custo FIXO     : ${centavos(fixoCentavos)}/mês (assinaturas — não escala)`);
  console.log(`custo VARIÁVEL : ${centavos(variavelCentavos)} no mês`);
  console.log(`custo total    : ${centavos(totalCentavos)}${algumDesconhecido ? " (INCOMPLETO)" : ""}`);

  const variavelPorSim = nSim > 0 ? variavelCentavos / nSim : 0;
  if (nSim > 0) {
    console.log(`variável/simul.: ${centavos(Math.round(variavelPorSim))}`);
    console.log(`efetivo/simul. : ${centavos(Math.round(totalCentavos / nSim))} (inclui o fixo diluído no volume atual)`);
  }

  if (algumDesconhecido) {
    console.log(
      "\nATENÇÃO: há chamadas sem preço configurado. O total acima é um piso, não o custo real.",
    );
  }

  // Margem contra o plano pago mais barato — a pergunta que o RNF-5 faz.
  //
  // Projetar o custo no teto do plano exige separar fixo de variável: a
  // assinatura NÃO se multiplica pelo número de simulações. Somar tudo e
  // multiplicar pelo teto produziria um custo dezenas de vezes maior que o
  // real e mataria um plano que na verdade é saudável.
  const pago = await prisma.plano.findFirst({
    where: { precoMensalCentavos: { gt: 0 } },
    orderBy: { precoMensalCentavos: "asc" },
  });
  if (pago && totalCentavos > 0) {
    const limites = JSON.parse(pago.limitesJson) as { simulacoesMes?: number };
    const teto = limites.simulacoesMes ?? 0;

    console.log(`\n--- MARGEM (plano ${pago.codigo}) ---`);
    console.log(`preço do plano  : ${centavos(pago.precoMensalCentavos)}/assinante/mês`);

    if (teto > 0 && nSim > 0) {
      // Um assinante no teto: paga uma vez o plano e consome `teto` simulações.
      // O custo fixo é do SISTEMA, diluído entre assinantes — projetamos aqui
      // o pior caso de um único assinante carregando a assinatura sozinho.
      const custoVariavelNoTeto = Math.round(variavelPorSim * teto);
      const pctVariavel = (custoVariavelNoTeto / pago.precoMensalCentavos) * 100;

      console.log(`variável no teto (${teto}): ${centavos(custoVariavelNoTeto)}  =  ${pctVariavel.toFixed(1)}% da receita`);
      console.log(`fixo do sistema : ${centavos(fixoCentavos)}/mês, diluído entre todos os assinantes`);

      const assinantesParaCobrirFixo =
        pago.precoMensalCentavos > custoVariavelNoTeto
          ? Math.ceil(fixoCentavos / (pago.precoMensalCentavos - custoVariavelNoTeto))
          : null;
      console.log(
        assinantesParaCobrirFixo == null
          ? "ALERTA: o custo variável no teto já consome a receita do plano."
          : `assinantes para cobrir o fixo: ${assinantesParaCobrirFixo}`,
      );

      if (pctVariavel > 30) {
        console.log("ALERTA: custo variável acima de 30% da receita do plano.");
      }
    } else {
      console.log("(volume insuficiente no mês para projetar a margem)");
    }
  }
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
