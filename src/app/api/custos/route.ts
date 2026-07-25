import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarAuditoria } from "@/lib/audit";
import { TIPOS_CUSTO } from "@/lib/custos";

const schema = z.object({
  tipo: z.enum(TIPOS_CUSTO),
  descricao: z.string().trim().min(1, "Informe a descrição").max(160),
  valor: z.coerce.number().min(0).default(0),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const custos = await prisma.custoRecorrente.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ custos });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const criado = await prisma.custoRecorrente.create({ data: { userId, ...parsed.data } });
  await registrarAuditoria({
    userId,
    entidade: "CustoRecorrente",
    entidadeId: criado.id,
    acao: "criar",
    depois: criado,
  });

  return NextResponse.json({ custo: criado }, { status: 201 });
}
