import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { garantirAssinaturaInicial } from "@/lib/billing";

const schema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(200),
  // Escolha de plano no cadastro. Ainda SEM COBRANÇA: o plano é atribuído
  // direto, o que serve para criar contas de teste em tiers diferentes. Quando
  // um gateway entrar, planos pagos passam por checkout antes desta atribuição.
  plano: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
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

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Cadastro self-service (RF-E1): conta, empresa e assinatura gratuita nascem
  // juntas e na mesma transação — um usuário sem plano não teria cota definida.
  const user = await prisma.$transaction(async (tx) => {
    const criado = await tx.user.create({
      data: { name, email, passwordHash, aceiteTermosEm: new Date() },
      select: { id: true, email: true, name: true },
    });

    await tx.empresa.create({
      data: { userId: criado.id, nome: name, padrao: true },
    });

    const escolhido = parsed.data.plano
      ? await tx.plano.findFirst({ where: { codigo: parsed.data.plano, ativo: true } })
      : null;

    if (escolhido) {
      await tx.assinatura.create({
        data: { userId: criado.id, planoId: escolhido.id, status: "ativa" },
      });
    } else {
      await garantirAssinaturaInicial(criado.id, tx);
    }
    return criado;
  });

  return NextResponse.json({ ok: true, user }, { status: 201 });
}
