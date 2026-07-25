import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getExchangeRate } from "@/lib/fx";
import { calcularTributos, round2 } from "@/lib/tax/engine";
import type { TaxInput } from "@/lib/tax/types";
import { normalizeNcm } from "@/lib/ncm/dataset";

const money = z.coerce.number().min(0).default(0);

const schema = z.object({
  ncm: z.string().min(1),
  descricaoProduto: z.string().max(2000).optional(),
  valorUnitarioMoeda: z.coerce.number().positive("Informe o valor do produto"),
  quantidade: z.coerce.number().positive("Informe a quantidade").default(1),
  moeda: z.string().min(1).default("USD"),
  uf: z.string().length(2, "Informe a UF de destino"),
  freteInternacional: money,
  seguroInternacional: money,
  thc: money,
  armazenagem: money,
  despachante: money,
  siscomex: money,
  afrmm: money,
  outrosCustos: money,
});

// POST — calcula os tributos + landed cost e salva a simulação (RF07-RF10, RF14).
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
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const ncm = normalizeNcm(d.ncm);
  const uf = d.uf.toUpperCase();

  // Câmbio buscado automaticamente pelo sistema (autoritativo no servidor).
  const quote = await getExchangeRate(d.moeda);

  // FOB total = valor unitário × quantidade (muitas importações têm >1 item).
  const fobMoeda = round2(d.valorUnitarioMoeda * d.quantidade);

  const input: TaxInput = {
    ncm,
    fobMoeda,
    quantidade: d.quantidade,
    valorUnitarioMoeda: d.valorUnitarioMoeda,
    moeda: quote.currency,
    taxaCambio: quote.rate,
    uf,
    freteInternacional: d.freteInternacional,
    seguroInternacional: d.seguroInternacional,
    thc: d.thc,
    armazenagem: d.armazenagem,
    despachante: d.despachante,
    siscomex: d.siscomex,
    afrmm: d.afrmm,
    outrosCustos: d.outrosCustos,
  };

  const resultado = calcularTributos(input);
  if (quote.simulado) {
    resultado.avisos.push(
      `Câmbio ${quote.currency} = R$ ${quote.rate} obtido de fonte simulada (protótipo).`,
    );
  }

  const registro = await prisma.simulacao.create({
    data: {
      userId,
      ncm,
      descricaoProduto: d.descricaoProduto ?? null,
      uf,
      moeda: quote.currency,
      inputJson: JSON.stringify(input),
      resultadoJson: JSON.stringify(resultado),
      landedCost: resultado.landedCost,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ id: registro.id, resultado });
}

// GET — histórico de simulações do usuário (assunção seção 12 do PRD).
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const simulacoes = await prisma.simulacao.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ncm: true,
      uf: true,
      moeda: true,
      descricaoProduto: true,
      landedCost: true,
      createdAt: true,
    },
    take: 100,
  });

  return NextResponse.json({ simulacoes });
}
