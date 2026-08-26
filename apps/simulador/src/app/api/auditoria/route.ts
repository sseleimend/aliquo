import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

// RF12 — leitura do log de auditoria dos cadastros do usuário.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      entidade: true,
      entidadeId: true,
      acao: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ logs });
}
