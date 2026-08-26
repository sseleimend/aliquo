import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCotacao, CambioIndisponivelError } from "@/lib/fx";
import { apenasDigitos, formatarNcm } from "@/lib/ncm/codigo";
import { consumirCota, limiteDeItens, QuotaExcedidaError } from "@/lib/plans";
import { resolverContexto } from "@/lib/tax/contexto";
import { calcular } from "@/lib/tax/engine";
import type { CustoCalculo, EntradaCalculo } from "@/lib/tax/types";

const money = z.coerce.number().min(0).default(0);

const itemSchema = z.object({
  ncm: z.string().min(1),
  descricaoProduto: z.string().max(2000).optional(),
  quantidade: z.coerce.number().positive().default(1),
  valorUnitarioMoeda: z.coerce.number().positive("Informe o valor do produto"),
  pesoLiquidoKg: z.coerce.number().min(0).optional(),
  ncmFonte: z.enum(["ia_confirmada", "manual", "reuso", "invoice"]).default("manual"),
  ncmConfianca: z.coerce.number().min(0).max(1).optional(),
  aliquotaIIManual: z.coerce.number().min(0).max(3).optional(),
  aliquotaIPIManual: z.coerce.number().min(0).max(3).optional(),
});

/**
 * Zod devolve mensagem padrão em inglês quando o campo não tem uma própria, e
 * ela chega crua na tela ("Number must be less than or equal to 0.35") — sem
 * dizer de qual campo, e falando na unidade interna. Quando isso acontecer,
 * pelo menos nomeamos o campo.
 */
function mensagemDeValidacao(erro: z.ZodError): string {
  const issue = erro.issues[0];
  if (!issue) return "Dados inválidos.";
  const padraoDoZod = /^(Expected|Invalid|Required|Number|String|Array|Too )/.test(issue.message);
  const campo = issue.path.filter((p) => typeof p === "string").join(".");
  return padraoDoZod && campo ? `Campo "${campo}": valor inválido.` : issue.message;
}

const schema = z.object({
  apelido: z.string().max(200).optional(),
  uf: z.string().length(2, "Informe a UF de destino"),
  moeda: z.string().min(1).default("USD"),
  incoterm: z.string().max(10).default("FOB"),
  modal: z.string().max(20).optional(),
  regimeTributario: z
    .enum(["lucro_real", "lucro_presumido", "simples_nacional"])
    .default("lucro_real"),
  empresaId: z.string().optional(),
  invoiceId: z.string().optional(),
  itens: z.array(itemSchema).min(1, "Informe ao menos um item"),
  freteInternacional: money,
  seguroInternacional: money,
  siscomex: money,
  afrmm: money,
  thc: money,
  armazenagem: money,
  despachante: money,
  outrosCustos: money,
  criterioRateio: z.enum(["valor", "peso", "quantidade"]).default("valor"),

  // Regime especial de ICMS declarado pelo usuário, em PONTOS PERCENTUAIS —
  // a mesma unidade que ele digita. Converter no cliente e validar no servidor
  // fazia a mensagem de erro falar de "0.35" para quem digitou "40".
  //
  // O teto de 35% só barra erro de digitação: a maior alíquota interna do país
  // é 23% e o adicional não passa de 2%. Não é regra fiscal.
  icmsAliquotaPercent: z
    .number({ message: "Informe a alíquota de ICMS em porcentagem (ex.: 4)" })
    .min(0, "A alíquota de ICMS não pode ser negativa")
    .max(35, "Alíquota de ICMS acima de 35% — confira se digitou em porcentagem (ex.: 4, não 400)")
    .optional(),
  icmsObservacao: z.string().max(120).optional(),
  fecpAplicavel: z.boolean().optional(),
});

type Dados = z.infer<typeof schema>;

/**
 * Monta as linhas de custo declarando, para cada uma, se compõe o valor
 * aduaneiro e se entra na base do ICMS — é o que o motor precisa saber para
 * ratear e tributar corretamente.
 */
function montarCustos(d: Dados): CustoCalculo[] {
  const criterio = d.criterioRateio;
  return [
    {
      chave: "frete",
      rotulo: "Frete internacional",
      valor: d.freteInternacional,
      compoeValorAduaneiro: true,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
    {
      chave: "seguro",
      rotulo: "Seguro internacional",
      valor: d.seguroInternacional,
      compoeValorAduaneiro: true,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
    {
      chave: "siscomex",
      rotulo: "Taxa Siscomex",
      valor: d.siscomex,
      compoeValorAduaneiro: false,
      entraBaseIcms: true,
      criterioRateio: criterio,
    },
    {
      chave: "afrmm",
      rotulo: "AFRMM",
      valor: d.afrmm,
      compoeValorAduaneiro: false,
      entraBaseIcms: true,
      criterioRateio: criterio,
    },
    {
      chave: "thc",
      rotulo: "THC",
      valor: d.thc,
      compoeValorAduaneiro: false,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
    {
      chave: "armazenagem",
      rotulo: "Armazenagem",
      valor: d.armazenagem,
      compoeValorAduaneiro: false,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
    {
      chave: "despachante",
      rotulo: "Honorários de despachante",
      valor: d.despachante,
      compoeValorAduaneiro: false,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
    {
      chave: "outros",
      rotulo: "Outros custos",
      valor: d.outrosCustos,
      compoeValorAduaneiro: false,
      entraBaseIcms: false,
      criterioRateio: criterio,
    },
  ].filter((c) => c.valor > 0);
}

// POST — calcula e persiste a importação (RF-C3, RF-D3, RNF-6).
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: mensagemDeValidacao(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Limite de itens por plano (RF-E2).
  const maxItens = await limiteDeItens(userId);
  if (maxItens > 0 && d.itens.length > maxItens) {
    return NextResponse.json(
      {
        error: `Seu plano permite ${maxItens} item(ns) por importação. Faça upgrade para lançar mais.`,
        upgrade: true,
      },
      { status: 402 },
    );
  }

  const uf = d.uf.toUpperCase();
  const itens = d.itens.map((i) => ({ ...i, ncm: apenasDigitos(i.ncm) }));

  // Câmbio resolvido no servidor — o cliente nunca envia a taxa.
  let cotacao;
  try {
    cotacao = await getCotacao({ moeda: d.moeda, finalidade: "fiscal" });
  } catch (e) {
    if (e instanceof CambioIndisponivelError) {
      return NextResponse.json(
        { error: e.message, exigeCambioManual: true, moeda: d.moeda },
        { status: 503 },
      );
    }
    throw e;
  }

  const ctx = await resolverContexto({
    ncms: itens.map((i) => i.ncm),
    uf,
    regime: d.regimeTributario,
    icmsManual: d.icmsAliquotaPercent != null ? d.icmsAliquotaPercent / 100 : undefined,
    icmsObservacao: d.icmsObservacao,
    fecpAplicavel: d.fecpAplicavel,
    fx: {
      moeda: cotacao.moeda,
      rate: cotacao.rate,
      fonte: cotacao.fonteRotulo,
      asOf: cotacao.asOf,
      dataRef: cotacao.dataRef,
      stale: cotacao.stale,
    },
  });

  const entrada: EntradaCalculo = {
    itens,
    custos: montarCustos(d),
    moeda: cotacao.moeda,
    taxaCambio: cotacao.rate,
    uf,
  };

  const resultado = calcular(entrada, ctx);
  resultado.avisos.push(...cotacao.avisos);

  const cotacaoLinha = await prisma.fxCotacao.findFirst({
    where: { moeda: cotacao.moeda, fonte: cotacao.fonte, dataRef: cotacao.dataRef },
    orderBy: { fetchedAt: "desc" },
    select: { id: true },
  });

  try {
    const registro = await prisma.$transaction(async (tx) => {
      // O incremento de uso acontece na MESMA transação da escrita para que a
      // contagem não divirja sob concorrência.
      await consumirCota(userId, "simulacao", tx);

      return tx.importacao.create({
        data: {
          userId,
          empresaId: d.empresaId ?? null,
          invoiceId: d.invoiceId ?? null,
          apelido: d.apelido ?? null,
          status: resultado.provisorio ? "bloqueada" : "simulada",
          uf,
          moeda: cotacao.moeda,
          incoterm: d.incoterm,
          modal: d.modal ?? null,
          regimeTributario: d.regimeTributario,
          rulesetId: resultado.rulesetId,
          baseVersaoId: ctx.baseVersaoId ?? null,
          fxCotacaoId: cotacaoLinha?.id ?? null,
          fxRate: cotacao.rate,
          fxFonte: cotacao.fonteRotulo,
          fxAsOf: new Date(cotacao.asOf),
          fxDataRef: cotacao.dataRef,
          fxStale: cotacao.stale,
          contextoJson: JSON.stringify(ctx),
          inputJson: JSON.stringify(entrada),
          resultadoJson: JSON.stringify(resultado),
          landedCost: resultado.landedCost,
          landedCostEfetivo: resultado.landedCostEfetivo,
          provisorio: resultado.provisorio,
          itens: {
            create: itens.map((i, idx) => {
              const r = resultado.itens[idx];
              return {
                ordem: idx,
                ncm: i.ncm,
                ncmDescricaoOficial: r?.descricaoOficial ?? null,
                ncmCaminhoOficial: r?.caminhoOficial ?? null,
                descricaoProduto: i.descricaoProduto ?? null,
                quantidade: i.quantidade,
                valorUnitarioMoeda: i.valorUnitarioMoeda,
                pesoLiquidoKg: i.pesoLiquidoKg ?? null,
                ncmFonte: i.ncmFonte,
                ncmConfianca: i.ncmConfianca ?? null,
                ncmConfirmadoEm: new Date(),
                aliquotaIIManual: i.aliquotaIIManual ?? null,
                aliquotaIPIManual: i.aliquotaIPIManual ?? null,
                resultadoJson: r ? JSON.stringify(r) : null,
                landedCost: r?.landedCost ?? null,
              };
            }),
          },
          custos: {
            create: montarCustos(d).map((c) => ({
              chave: c.chave,
              rotulo: c.rotulo,
              valor: c.valor,
              compoeValorAduaneiro: c.compoeValorAduaneiro,
              entraBaseIcms: c.entraBaseIcms,
              criterioRateio: c.criterioRateio,
            })),
          },
        },
        select: { id: true },
      });
    });

    // Os itens da fatura são HERDADOS da importação — nunca digitados. Só
    // preenchemos na primeira vez, para a fatura descrever o embarque original
    // mesmo que ela seja reaproveitada depois em outras importações.
    if (d.invoiceId) {
      try {
        const jaTem = await prisma.invoiceItem.count({ where: { invoiceId: d.invoiceId } });
        if (jaTem === 0) {
          await prisma.invoiceItem.createMany({
            data: itens.map((i) => ({
              invoiceId: d.invoiceId!,
              descricao: i.descricaoProduto ?? formatarNcm(i.ncm),
              ncm: i.ncm,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitarioMoeda,
            })),
          });
        }
      } catch {
        // Espelhar os itens é conveniência; não pode derrubar a simulação.
      }
    }

    return NextResponse.json({ id: registro.id, resultado });
  } catch (e) {
    if (e instanceof QuotaExcedidaError) {
      return NextResponse.json(
        { error: e.message, upgrade: true, tipo: e.tipo, limite: e.limite, usado: e.usado },
        { status: 402 },
      );
    }
    throw e;
  }
}

// GET — histórico (semente do hub, RF-D3).
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const importacoes = await prisma.importacao.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      apelido: true,
      uf: true,
      moeda: true,
      status: true,
      landedCost: true,
      provisorio: true,
      createdAt: true,
      itens: { select: { ncm: true, descricaoProduto: true }, orderBy: { ordem: "asc" } },
    },
  });

  return NextResponse.json({
    importacoes: importacoes.map((i) => ({
      ...i,
      ncmPrincipal: i.itens[0] ? formatarNcm(i.itens[0].ncm) : null,
      qtdItens: i.itens.length,
    })),
  });
}
