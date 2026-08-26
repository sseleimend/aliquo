import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gerarPdf } from "@/lib/export/pdf";
import { exigirRecurso, RecursoIndisponivelError } from "@/lib/plans";
import type { EntradaCalculo, ResultadoCalculo } from "@/lib/tax/types";

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return new Response("Não autenticado", { status: 401 });

  try {
    await exigirRecurso(userId, "exportPdf");
  } catch (e) {
    if (e instanceof RecursoIndisponivelError) return new Response(e.message, { status: 402 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const imp = await prisma.importacao.findFirst({ where: { id, userId } });
  if (!imp) return new Response("Importação não encontrada", { status: 404 });

  const resultado = JSON.parse(imp.resultadoJson) as ResultadoCalculo;
  // A entrada vai embutida no arquivo para permitir reimportação sem perda.
  let entrada: EntradaCalculo | undefined;
  try {
    entrada = JSON.parse(imp.inputJson) as EntradaCalculo;
  } catch {
    /* registro antigo sem entrada utilizável — exporta sem o payload */
  }
  const buffer = await gerarPdf({
    resultado,
    apelido: imp.apelido,
    createdAt: imp.createdAt,
    importacaoId: imp.id,
    entrada,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aliquo-${imp.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
