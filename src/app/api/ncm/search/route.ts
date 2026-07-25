import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { buscarPorCodigo } from "@/lib/ncm/classifier";
import { normalizeNcm } from "@/lib/ncm/dataset";

// RF01 — consulta direta por código NCM.
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("ncm") ?? "";
  const ncm = normalizeNcm(raw);
  const digits = ncm.replace(/\D/g, "");

  if (digits.length !== 8) {
    return NextResponse.json(
      { error: "Informe um NCM com 8 dígitos", ncm },
      { status: 400 },
    );
  }

  const entry = buscarPorCodigo(ncm);
  return NextResponse.json({
    ncm,
    encontrado: Boolean(entry),
    descricao: entry?.descricao ?? null,
    categoria: entry?.categoria ?? null,
    // Mesmo sem estar na base de amostra, o usuário pode prosseguir manualmente.
    aviso: entry
      ? null
      : "NCM não encontrado na base de amostra do protótipo — você pode prosseguir, mas o cálculo usará alíquotas federais padrão.",
  });
}
