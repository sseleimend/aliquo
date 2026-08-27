import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { apenasDigitos, formatarNcm } from "@/lib/ncm/codigo";
import { buscarPorCodigo, sugerirPorPrefixo } from "@/lib/ncm/retrieval";

/**
 * RF-A3 — caminho rápido do importador experiente.
 * `?ncm=` consulta um código exato; `?q=` faz type-ahead por código ou texto.
 */
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const termo = (searchParams.get("q") ?? "").trim();

  if (termo) {
    const sugestoes = await sugerirPorPrefixo(termo, 10);
    return NextResponse.json({ sugestoes });
  }

  const raw = searchParams.get("ncm") ?? "";
  const digitos = apenasDigitos(raw);
  if (digitos.length !== 8) {
    return NextResponse.json(
      { error: "Informe um NCM com 8 dígitos", ncm: formatarNcm(digitos) },
      { status: 400 },
    );
  }

  const entry = await buscarPorCodigo(digitos);
  return NextResponse.json({
    ncm: formatarNcm(digitos),
    encontrado: Boolean(entry),
    descricao: entry?.descricao ?? null,
    caminho: entry?.caminho ?? null,
    // Sem estar na base oficial, o código não é calculável — e dizemos isso.
    aviso: entry
      ? null
      : "NCM não encontrada na base oficial carregada. Confirme o código: o cálculo não será feito sem alíquota oficial.",
  });
}
