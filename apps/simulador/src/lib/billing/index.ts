/**
 * Cobrança — interface plugável (decisão travada: gateway depois).
 *
 * A Fase 2 entrega planos, limites e paywall funcionando com atribuição
 * manual de plano. Stripe / Asaas / Mercado Pago entram como uma segunda
 * implementação desta interface mais uma rota de webhook, sem tocar no
 * domínio: `Assinatura` já carrega os campos `provider*` nulos.
 */

import { prisma } from "@/lib/db";

export interface AssinaturaResumo {
  planoCodigo: string;
  status: string;
  periodoFim: Date | null;
}

export interface BillingProvider {
  readonly nome: string;
  /** URL para o usuário assinar/alterar plano. null = fluxo manual. */
  urlCheckout(userId: string, planoCodigo: string): Promise<string | null>;
  atribuirPlano(userId: string, planoCodigo: string): Promise<AssinaturaResumo>;
  cancelar(userId: string): Promise<void>;
}

export const manualBillingProvider: BillingProvider = {
  nome: "manual",

  async urlCheckout() {
    return null;
  },

  async atribuirPlano(userId, planoCodigo) {
    const plano = await prisma.plano.findUnique({ where: { codigo: planoCodigo } });
    if (!plano) throw new Error(`Plano desconhecido: ${planoCodigo}`);

    const assinatura = await prisma.assinatura.upsert({
      where: { userId },
      update: { planoId: plano.id, status: "ativa", periodoInicio: new Date(), periodoFim: null },
      create: { userId, planoId: plano.id, status: "ativa" },
    });

    return {
      planoCodigo: plano.codigo,
      status: assinatura.status,
      periodoFim: assinatura.periodoFim,
    };
  },

  async cancelar(userId) {
    await prisma.assinatura.updateMany({
      where: { userId },
      data: { status: "cancelada", periodoFim: new Date() },
    });
  },
};

export function getBillingProvider(): BillingProvider {
  // Quando um gateway for plugado, selecione aqui por env.
  return manualBillingProvider;
}

/** Cria a assinatura gratuita no cadastro (RF-E1). */
export async function garantirAssinaturaInicial(
  userId: string,
  tx: {
    plano: typeof prisma.plano;
    assinatura: typeof prisma.assinatura;
  } = prisma,
): Promise<void> {
  const free = await tx.plano.findUnique({ where: { codigo: "free" } });
  if (!free) return; // banco ainda não semeado

  const existente = await tx.assinatura.findUnique({ where: { userId } });
  if (existente) return;

  await tx.assinatura.create({ data: { userId, planoId: free.id, status: "ativa" } });
}
