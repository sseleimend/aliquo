import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@aliquo.com";
  const passwordHash = await bcrypt.hash("demo123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Usuário Demo", passwordHash },
  });

  // Despachantes de amostra (RF11).
  const jaTemDespachantes = await prisma.despachante.count({ where: { userId: user.id } });
  if (jaTemDespachantes === 0) {
    await prisma.despachante.createMany({
      data: [
        { userId: user.id, nome: "Despachante Santos & Cia", cnpj: "12.345.678/0001-90", contato: "contato@santoscia.com.br", honorarios: 850 },
        { userId: user.id, nome: "ComexFast Assessoria", cnpj: "98.765.432/0001-10", contato: "(11) 4002-8922", honorarios: 1200 },
      ],
    });
  }

  // Custos recorrentes de amostra (RF11).
  const jaTemCustos = await prisma.custoRecorrente.count({ where: { userId: user.id } });
  if (jaTemCustos === 0) {
    await prisma.custoRecorrente.createMany({
      data: [
        { userId: user.id, tipo: "siscomex", descricao: "Taxa Siscomex (DI padrão)", valor: 214.5 },
        { userId: user.id, tipo: "thc", descricao: "THC porto de Santos", valor: 1150 },
        { userId: user.id, tipo: "armazenagem", descricao: "Armazenagem alfandegada (estimativa)", valor: 600 },
      ],
    });
  }

  console.log(`Seed concluído. Usuário demo: ${email} / senha: demo123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
