import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarAuditoria } from "@/lib/audit";

const schema = z.object({
  nome: z.string().trim().min(1).max(160).optional(),
  cnpj: z.string().trim().max(20).optional().nullable(),
  contato: z.string().trim().max(160).optional().nullable(),
  honorarios: z.coerce.number().min(0).optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const antes = await prisma.despachante.findFirst({ where: { id, userId } });
  if (!antes) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const atualizado = await prisma.despachante.update({
    where: { id },
    data: parsed.data,
  });
  await registrarAuditoria({
    userId,
    entidade: "Despachante",
    entidadeId: id,
    acao: "atualizar",
    antes,
    depois: atualizado,
  });

  return NextResponse.json({ despachante: atualizado });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const antes = await prisma.despachante.findFirst({ where: { id, userId } });
  if (!antes) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.despachante.delete({ where: { id } });
  await registrarAuditoria({
    userId,
    entidade: "Despachante",
    entidadeId: id,
    acao: "remover",
    antes,
  });

  return NextResponse.json({ ok: true });
}
