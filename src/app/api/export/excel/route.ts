import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gerarExcel } from "@/lib/export/excel";
import type { TaxResult } from "@/lib/tax/types";

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return new Response("Não autenticado", { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const sim = await prisma.simulacao.findFirst({ where: { id, userId } });
  if (!sim) return new Response("Simulação não encontrada", { status: 404 });

  const resultado = JSON.parse(sim.resultadoJson) as TaxResult;
  const buffer = await gerarExcel({
    resultado,
    descricaoProduto: sim.descricaoProduto,
    createdAt: sim.createdAt,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aliquo-simulacao-${sim.id}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
