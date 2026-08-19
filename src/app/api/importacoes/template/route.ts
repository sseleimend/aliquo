import { getUserId } from "@/lib/auth";
import { gerarTemplate } from "@/lib/migracao/template";

/** Template de planilha para migrar histórico de outra ferramenta. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return new Response("Não autenticado", { status: 401 });

  const buffer = await gerarTemplate();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="aliquo-modelo-importacao.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
