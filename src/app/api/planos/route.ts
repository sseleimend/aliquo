import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Planos disponíveis (RF-E1).
 *
 * Pública de propósito: a tela de cadastro precisa listar os planos antes de
 * existir uma sessão. Só devolve dados de catálogo — nada de assinante.
 */
export async function GET() {
  const planos = await prisma.plano.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
  });

  return NextResponse.json({
    planos: planos.map((p) => {
      let limites: Record<string, unknown> = {};
      try {
        limites = JSON.parse(p.limitesJson);
      } catch {
        /* plano com JSON inválido não pode derrubar o cadastro */
      }
      return {
        codigo: p.codigo,
        nome: p.nome,
        precoMensalCentavos: p.precoMensalCentavos,
        limites,
      };
    }),
  });
}
