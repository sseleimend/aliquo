import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileStore } from "@/lib/storage";

/**
 * Download do arquivo da fatura.
 *
 * É a ÚNICA porta de acesso ao conteúdo: os arquivos ficam fora de `public/`,
 * então não há URL adivinhável. A consulta é escopada por `userId`, de modo que
 * um id de outra conta devolve 404 — não 403, para não confirmar existência.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return new Response("Não autenticado", { status: 401 });

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    select: { arquivoKey: true, arquivoNome: true, arquivoMime: true },
  });
  if (!invoice?.arquivoKey) return new Response("Arquivo não encontrado", { status: 404 });

  let dados: Buffer;
  try {
    dados = await getFileStore().get(invoice.arquivoKey);
  } catch {
    return new Response("Arquivo indisponível no armazenamento", { status: 410 });
  }

  return new Response(new Uint8Array(dados), {
    headers: {
      "Content-Type": invoice.arquivoMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(invoice.arquivoNome ?? "fatura").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
