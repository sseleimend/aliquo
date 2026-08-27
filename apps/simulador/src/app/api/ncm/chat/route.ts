import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { descobrirNcm } from "@/lib/ncm/classifier";
import { consumirCota, QuotaExcedidaError, registrarEventoIA } from "@/lib/plans";

const respostaSchema = z.object({
  atributo: z.string().max(120),
  valor: z.string().max(2000),
  indice: z.coerce.number().int().min(0).optional(),
});

const schema = z.object({
  descricao: z.string().trim().min(2, "Descreva o produto").max(4000),
  respostas: z.array(respostaSchema).max(10).optional(),
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
    await consumirCota(userId, "ncm_chat");
  } catch (e) {
    if (e instanceof QuotaExcedidaError) {
      return NextResponse.json(
        { error: e.message, upgrade: true, limite: e.limite, usado: e.usado },
        { status: 402 },
      );
    }
    throw e;
  }

  try {
    const resposta = await descobrirNcm(parsed.data);
    // RNF-5 — custo por operação.
    if (resposta.meta.custo) {
      await registrarEventoIA(userId, resposta.meta.custo);
    }
    return NextResponse.json(resposta);
  } catch (err) {
    console.error("Erro na descoberta de NCM:", err);
    return NextResponse.json(
      { error: "Falha ao consultar a base de NCM. Tente novamente." },
      { status: 502 },
    );
  }
}
