import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileStore } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    include: { itens: true },
  });
  if (!invoice) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  return NextResponse.json({ invoice });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    select: { id: true, arquivoKey: true, _count: { select: { importacoes: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  // Uma invoice já usada faz parte do histórico de uma importação salva —
  // apagá-la quebraria a rastreabilidade daquele cálculo (RNF-6).
  if (invoice._count.importacoes > 0) {
    return NextResponse.json(
      {
        error: `Esta fatura está vinculada a ${invoice._count.importacoes} importação(ões) e não pode ser removida.`,
      },
      { status: 409 },
    );
  }

  if (invoice.arquivoKey) {
    try {
      await getFileStore().delete(invoice.arquivoKey);
    } catch {
      /* arquivo já ausente não impede remover o registro */
    }
  }
  await prisma.invoice.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
