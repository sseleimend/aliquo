import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * RF-D4 — duplicar simulação.
 *
 * NÃO copia o resultado antigo: devolve a ENTRADA para o cliente recalcular
 * com câmbio e base atuais. Copiar um número velho seria apresentar como
 * atual um custo que já mudou — o oposto do que a Fase 2 se propõe.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const origem = await prisma.importacao.findFirst({
    where: { id, userId },
    include: {
      itens: { orderBy: { ordem: "asc" } },
      custos: true,
      invoice: { select: { id: true, numero: true, fornecedor: true, arquivoNome: true } },
    },
  });
  if (!origem) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const custoPor = (chave: string) => origem.custos.find((c) => c.chave === chave)?.valor ?? 0;
  // O critério é do embarque, não de um custo isolado: todos os custos da
  // importação foram gravados com o mesmo. Sem devolvê-lo, um reuso rateado
  // por peso voltava silenciosamente para rateio por valor.
  const criterioRateio = origem.custos[0]?.criterioRateio ?? "valor";

  // A declaração de regime especial vive no snapshot do contexto (é dele que
  // saiu a alíquota aplicada). Sem devolvê-la, um reuso de importação com TTD
  // voltaria calculando pela tabela cheia — erro de pontos percentuais.
  let icms: { manual?: number; observacao?: string; fecpAplicavel?: boolean } = {};
  try {
    const ctxSalvo = JSON.parse(origem.contextoJson) as {
      icmsDetalhe?: {
        interna: number;
        fecpAplicado: boolean;
        declarado: boolean;
        observacao?: string;
      };
    };
    const d = ctxSalvo.icmsDetalhe;
    if (d?.declarado) {
      icms = { manual: d.interna, observacao: d.observacao, fecpAplicavel: false };
    } else if (d) {
      icms = { fecpAplicavel: d.fecpAplicado };
    }
  } catch {
    /* contexto antigo sem o campo — segue com o padrão da UF */
  }

  return NextResponse.json({
    duplicadaDeId: origem.id,
    // A fatura anexada acompanha o reuso: é o mesmo embarque de origem.
    invoice: origem.invoice,
    rascunho: {
      apelido: origem.apelido ? `${origem.apelido} (cópia)` : null,
      uf: origem.uf,
      moeda: origem.moeda,
      incoterm: origem.incoterm,
      modal: origem.modal,
      regimeTributario: origem.regimeTributario,
      empresaId: origem.empresaId,
      invoiceId: origem.invoiceId,
      criterioRateio,
      icms,
      itens: origem.itens.map((i) => ({
        ncm: i.ncm,
        descricaoProduto: i.descricaoProduto,
        quantidade: i.quantidade,
        valorUnitarioMoeda: i.valorUnitarioMoeda,
        pesoLiquidoKg: i.pesoLiquidoKg,
        ncmFonte: "reuso" as const,
        ncmDescricaoOficial: i.ncmDescricaoOficial,
        ncmCaminhoOficial: i.ncmCaminhoOficial,
      })),
      freteInternacional: custoPor("frete"),
      seguroInternacional: custoPor("seguro"),
      siscomex: custoPor("siscomex"),
      afrmm: custoPor("afrmm"),
      thc: custoPor("thc"),
      armazenagem: custoPor("armazenagem"),
      despachante: custoPor("despachante"),
      outrosCustos: custoPor("outros"),
    },
    aviso:
      "Os valores foram copiados, mas o câmbio e as alíquotas serão buscados novamente " +
      "no momento do cálculo — podem ter mudado desde a simulação original.",
  });
}
