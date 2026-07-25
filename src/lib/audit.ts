import { prisma } from "@/lib/db";

// RF12 — registra alteração nos cadastros de despachantes/custos recorrentes.
export async function registrarAuditoria(params: {
  userId: string;
  entidade: "Despachante" | "CustoRecorrente";
  entidadeId: string;
  acao: "criar" | "atualizar" | "remover";
  antes?: unknown;
  depois?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      acao: params.acao,
      dadosAntes: params.antes ? JSON.stringify(params.antes) : null,
      dadosDepois: params.depois ? JSON.stringify(params.depois) : null,
    },
  });
}
