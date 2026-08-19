import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { CambioIndisponivelError, getCotacao, getCotacaoMercado, moedasSuportadas } from "@/lib/fx";

/**
 * RF-C1 — cotação com fonte e data visíveis.
 * Devolve a taxa FISCAL (PTAX do dia útil anterior, base legal da valoração
 * aduaneira) e, junto, a de MERCADO, para o usuário ver a diferença.
 */
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const moeda = (searchParams.get("moeda") ?? searchParams.get("currency") ?? "USD").toUpperCase();

  try {
    const fiscal = await getCotacao({ moeda, finalidade: "fiscal" });
    const mercado = await getCotacaoMercado(moeda);
    return NextResponse.json({
      fiscal,
      mercado,
      divergenciaPct:
        mercado && fiscal.rate ? ((mercado.rate - fiscal.rate) / fiscal.rate) * 100 : null,
      moedasSuportadas: moedasSuportadas(),
    });
  } catch (e) {
    if (e instanceof CambioIndisponivelError) {
      return NextResponse.json(
        { error: e.message, exigeCambioManual: true, moeda, moedasSuportadas: moedasSuportadas() },
        { status: 503 },
      );
    }
    throw e;
  }
}
