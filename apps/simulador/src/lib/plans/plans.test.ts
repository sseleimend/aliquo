import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { checarCota, competenciaAtual, consumirCota, QuotaExcedidaError } from "./index";

/**
 * Teste de limite de plano nas fronteiras (RF-E2).
 * Usa um usuário descartável para não sujar o banco de desenvolvimento.
 */
const EMAIL = "teste-cota@aliquo.local";
let userId = "";

beforeAll(async () => {
  const plano = await prisma.plano.upsert({
    where: { codigo: "teste-3" },
    update: { limitesJson: JSON.stringify({ simulacoesMes: 3 }) },
    create: {
      codigo: "teste-3",
      nome: "Teste (3/mês)",
      limitesJson: JSON.stringify({ simulacoesMes: 3 }),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Cota" },
  });
  userId = user.id;

  await prisma.usoMensal.deleteMany({ where: { userId } });
  await prisma.assinatura.upsert({
    where: { userId },
    update: { planoId: plano.id, status: "ativa" },
    create: { userId, planoId: plano.id, status: "ativa" },
  });
});

afterAll(async () => {
  await prisma.usoMensal.deleteMany({ where: { userId } });
  await prisma.assinatura.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.plano.deleteMany({ where: { codigo: "teste-3" } });
});

describe("cota mensal", () => {
  it("permite até o limite e barra na tentativa seguinte", async () => {
    expect((await checarCota(userId, "simulacao")).restante).toBe(3);

    await consumirCota(userId, "simulacao");
    await consumirCota(userId, "simulacao");
    expect((await checarCota(userId, "simulacao")).restante).toBe(1);

    // A terceira ainda passa — o limite é 3, não 2.
    await consumirCota(userId, "simulacao");
    const status = await checarCota(userId, "simulacao");
    expect(status.usado).toBe(3);
    expect(status.permitido).toBe(false);

    await expect(consumirCota(userId, "simulacao")).rejects.toBeInstanceOf(QuotaExcedidaError);
  }, 30_000);

  it("conta por competência mensal", async () => {
    const registro = await prisma.usoMensal.findUnique({
      where: {
        userId_competencia_tipo: {
          userId,
          competencia: competenciaAtual(),
          tipo: "simulacao",
        },
      },
    });
    expect(registro?.total).toBe(3);
  }, 30_000);

  it("tipos de uso diferentes têm cotas independentes", async () => {
    const chat = await checarCota(userId, "ncm_chat");
    expect(chat.usado).toBe(0);
    expect(chat.permitido).toBe(true);
  }, 30_000);
});
