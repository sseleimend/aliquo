import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TaxResult } from "@/lib/tax/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const sim = await prisma.simulacao.findFirst({ where: { id, userId } });
  if (!sim) return NextResponse.json({ error: "Simulação não encontrada" }, { status: 404 });

  const resultado = JSON.parse(sim.resultadoJson) as TaxResult;
  return NextResponse.json({
    id: sim.id,
    ncm: sim.ncm,
    descricaoProduto: sim.descricaoProduto,
    uf: sim.uf,
    moeda: sim.moeda,
    createdAt: sim.createdAt,
    resultado,
  });
}
