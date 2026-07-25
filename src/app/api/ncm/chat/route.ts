import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { descobrirNcm } from "@/lib/ncm/classifier";

const schema = z.object({
  descricao: z.string().trim().min(2, "Descreva o produto").max(4000),
  respostas: z.array(z.string().max(2000)).max(10).optional(),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  try {
    const resposta = await descobrirNcm(parsed.data);
    return NextResponse.json(resposta);
  } catch (err) {
    console.error("Erro no chat de NCM:", err);
    return NextResponse.json(
      { error: "Falha ao consultar o classificador de NCM. Tente novamente." },
      { status: 502 },
    );
  }
}
