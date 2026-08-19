/**
 * Planos, limites e medição de uso (RF-E1, RF-E2, RNF-5).
 *
 * Ponto ÚNICO de enforcement: `consumirCota`. Toda rota medida chama isso, e
 * o incremento acontece na MESMA transação da escrita — senão a contagem
 * diverge sob concorrência e o limite vira decorativo.
 *
 * O cliente nunca decide cota; `checarCota` existe só para a UI mostrar
 * "3 de 5 simulações usadas".
 */

import { prisma } from "@/lib/db";
import { custoUsdDaChamada, precoDe, usdParaCentavosBrl } from "@/lib/llm/custo";

export type TipoUso = "simulacao" | "ncm_chat" | "export_pdf" | "invoice_upload";

export interface Limites {
  simulacoesMes: number; // 0 = ilimitado
  itensPorImportacao: number;
  ncmChatMes: number;
  exportPdf: boolean;
  invoiceUpload: boolean;
}

export const LIMITES_PADRAO: Limites = {
  simulacoesMes: 5,
  itensPorImportacao: 1,
  ncmChatMes: 20,
  exportPdf: true,
  invoiceUpload: false,
};

const CHAVE_LIMITE: Record<TipoUso, keyof Limites | null> = {
  simulacao: "simulacoesMes",
  ncm_chat: "ncmChatMes",
  export_pdf: null,
  invoice_upload: null,
};

export class QuotaExcedidaError extends Error {
  readonly status = 402;
  constructor(
    readonly tipo: TipoUso,
    readonly limite: number,
    readonly usado: number,
    readonly plano: string,
  ) {
    super(
      `Limite do plano ${plano} atingido: ${usado}/${limite} para ${tipo} neste mês. ` +
        `Faça upgrade para continuar.`,
    );
    this.name = "QuotaExcedidaError";
  }
}

export class RecursoIndisponivelError extends Error {
  readonly status = 402;
  constructor(readonly recurso: string, readonly plano: string) {
    super(`O recurso "${recurso}" não está incluído no plano ${plano}.`);
    this.name = "RecursoIndisponivelError";
  }
}

export function competenciaAtual(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseLimites(json: string): Limites {
  try {
    return { ...LIMITES_PADRAO, ...(JSON.parse(json) as Partial<Limites>) };
  } catch {
    return LIMITES_PADRAO;
  }
}

export interface PlanoAtivo {
  codigo: string;
  nome: string;
  limites: Limites;
}

/**
 * Plano vigente do usuário. Sem assinatura, cai no plano `free`; sem nem isso
 * (banco não semeado), usa os limites padrão — nunca bloqueia por acidente
 * de configuração.
 */
export async function planoDoUsuario(userId: string): Promise<PlanoAtivo> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { userId },
    include: { plano: true },
  });

  if (assinatura && assinatura.status !== "cancelada") {
    return {
      codigo: assinatura.plano.codigo,
      nome: assinatura.plano.nome,
      limites: parseLimites(assinatura.plano.limitesJson),
    };
  }

  const free = await prisma.plano.findUnique({ where: { codigo: "free" } });
  if (free) {
    return { codigo: free.codigo, nome: free.nome, limites: parseLimites(free.limitesJson) };
  }
  return { codigo: "free", nome: "Gratuito", limites: LIMITES_PADRAO };
}

export interface StatusCota {
  permitido: boolean;
  limite: number; // 0 = ilimitado
  usado: number;
  restante: number;
  plano: string;
}

export async function checarCota(userId: string, tipo: TipoUso): Promise<StatusCota> {
  const plano = await planoDoUsuario(userId);
  const chave = CHAVE_LIMITE[tipo];
  const limite = chave ? (plano.limites[chave] as number) : 0;

  const registro = await prisma.usoMensal.findUnique({
    where: { userId_competencia_tipo: { userId, competencia: competenciaAtual(), tipo } },
  });
  const usado = registro?.total ?? 0;

  return {
    permitido: limite === 0 || usado < limite,
    limite,
    usado,
    restante: limite === 0 ? Number.POSITIVE_INFINITY : Math.max(0, limite - usado),
    plano: plano.codigo,
  };
}

/**
 * Verifica e consome uma unidade de cota. Lança QuotaExcedidaError quando
 * estourado. Passe `tx` para que o incremento participe da mesma transação
 * da escrita que ele autoriza.
 */
export async function consumirCota(
  userId: string,
  tipo: TipoUso,
  tx: { usoMensal: typeof prisma.usoMensal } = prisma,
): Promise<void> {
  const status = await checarCota(userId, tipo);
  if (!status.permitido) {
    throw new QuotaExcedidaError(tipo, status.limite, status.usado, status.plano);
  }

  const competencia = competenciaAtual();
  await tx.usoMensal.upsert({
    where: { userId_competencia_tipo: { userId, competencia, tipo } },
    update: { total: { increment: 1 } },
    create: { userId, competencia, tipo, total: 1 },
  });
}

/** Garante que um recurso booleano do plano está liberado. */
export async function exigirRecurso(userId: string, recurso: "exportPdf" | "invoiceUpload") {
  const plano = await planoDoUsuario(userId);
  if (!plano.limites[recurso]) {
    throw new RecursoIndisponivelError(recurso, plano.codigo);
  }
}

/** Teto de itens por importação no plano (RF-D1 tem limite por tier). */
export async function limiteDeItens(userId: string): Promise<number> {
  const plano = await planoDoUsuario(userId);
  return plano.limites.itensPorImportacao;
}

/**
 * Registra uma operação de IA e seu custo (RNF-5).
 *
 * Grava os tokens sempre — são fato medido. O custo só é gravado quando o
 * provider cobra por token; em provider de assinatura ele depende do volume
 * do mês e é calculado no relatório (`npm run custo:ia`). Custo desconhecido
 * fica `null`, nunca 0.
 *
 * Best-effort: telemetria nunca derruba a operação que ela mede.
 */
export async function registrarEventoIA(
  userId: string,
  meta: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  },
): Promise<void> {
  try {
    const preco = precoDe(meta.provider ?? "", meta.model ?? "");
    const usd = custoUsdDaChamada(preco, meta.inputTokens, meta.outputTokens);

    let centavos: number | null = null;
    if (usd != null) {
      // Usa o câmbio já em cache; sem cotação, o custo em BRL fica pendente.
      const cotacao = await prisma.fxCotacao
        .findFirst({ where: { moeda: "USD" }, orderBy: { fetchedAt: "desc" } })
        .catch(() => null);
      if (cotacao) centavos = usdParaCentavosBrl(usd, cotacao.rate);
    }

    await prisma.eventoUso.create({
      data: {
        userId,
        tipo: "ncm_chat",
        quantidade: 1,
        provider: meta.provider ?? null,
        model: meta.model ?? null,
        inputTokens: meta.inputTokens ?? null,
        outputTokens: meta.outputTokens ?? null,
        latencyMs: meta.latencyMs ?? null,
        modeloCusto: preco.tipo,
        custoEstimadoCentavos: centavos,
        metaJson: usd != null ? JSON.stringify({ custoUsd: usd }) : null,
      },
    });
  } catch {
    /* telemetria não pode quebrar o fluxo */
  }
}
