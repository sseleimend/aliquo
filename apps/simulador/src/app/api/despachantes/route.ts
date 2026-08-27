import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarAuditoria } from "@/lib/audit";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  cnpj: z.string().trim().max(20).optional().nullable(),
  contato: z.string().trim().max(160).optional().nullable(),
  honorarios: z.coerce.number().min(0).default(0),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const despachantes = await prisma.despachante.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ despachantes });
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

  const criado = await prisma.despachante.create({
    data: { userId, ...parsed.data },
  });
  await registrarAuditoria({
    userId,
    entidade: "Despachante",
    entidadeId: criado.id,
    acao: "criar",
    depois: criado,
  });

  return NextResponse.json({ despachante: criado }, { status: 201 });
}
