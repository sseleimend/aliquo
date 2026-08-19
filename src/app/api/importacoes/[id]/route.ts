import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET — uma importação, escopada ao dono.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const imp = await prisma.importacao.findFirst({
    where: { id, userId },
    include: { itens: { orderBy: { ordem: "asc" } }, custos: true },
  });
  if (!imp) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  return NextResponse.json({
    importacao: {
      ...imp,
      resultado: JSON.parse(imp.resultadoJson),
      entrada: JSON.parse(imp.inputJson),
    },
  });
}

// DELETE — remove do histórico.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const existente = await prisma.importacao.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existente) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await prisma.importacao.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
