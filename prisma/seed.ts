import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ICMS_POR_UF } from "../src/lib/tax/rates";

const prisma = new PrismaClient();

const PLANOS = [
  {
    codigo: "free",
    nome: "Gratuito",
    precoMensalCentavos: 0,
    ordem: 0,
    limites: {
      simulacoesMes: 5,
      itensPorImportacao: 1,
      ncmChatMes: 20,
      exportPdf: true,
      invoiceUpload: false,
    },
  },
  {
    codigo: "pro",
    nome: "Pro",
    precoMensalCentavos: 14900,
    ordem: 1,
    limites: {
      simulacoesMes: 100,
      itensPorImportacao: 20,
      ncmChatMes: 500,
      exportPdf: true,
      invoiceUpload: true,
    },
  },
  {
    codigo: "business",
    nome: "Business",
    precoMensalCentavos: 49900,
    ordem: 2,
    limites: {
      simulacoesMes: 0, // ilimitado
      itensPorImportacao: 200,
      ncmChatMes: 0,
      exportPdf: true,
      invoiceUpload: true,
    },
  },
];

async function main() {
  // --- Planos (RF-E1) ----------------------------------------------------
  for (const p of PLANOS) {
    await prisma.plano.upsert({
      where: { codigo: p.codigo },
      update: {
        nome: p.nome,
        precoMensalCentavos: p.precoMensalCentavos,
        limitesJson: JSON.stringify(p.limites),
        ordem: p.ordem,
      },
      create: {
        codigo: p.codigo,
        nome: p.nome,
        precoMensalCentavos: p.precoMensalCentavos,
        limitesJson: JSON.stringify(p.limites),
        ordem: p.ordem,
      },
    });
  }

  // --- Alíquotas de ICMS por UF ------------------------------------------
  // Versionadas em banco para poderem ser corrigidas sem deploy, e marcadas
  // como ESTIMATIVA: não há tabela oficial consolidada dos 27 estados, e esta
  // não captura benefício estadual de importação. Para substituir por dado
  // real: `npx tsx scripts/importar-aliquotas-uf.ts <arquivo.csv>`.
  const vigenciaIni = new Date("2026-01-01T00:00:00.000Z");
  const fonteEstimada = "estimativa — confirmar na SEFAZ do estado";
  for (const [uf, v] of Object.entries(ICMS_POR_UF)) {
    const dados = {
      aliquota: v.interna,
      fecp: v.fecp,
      fecpPadrao: v.fecpPadrao,
      fonte: fonteEstimada,
    };
    await prisma.aliquotaUf.upsert({
      where: { uf_vigenciaIni: { uf, vigenciaIni } },
      update: dados,
      create: { uf, vigenciaIni, ...dados },
    });
  }

  // --- Usuário demo ------------------------------------------------------
  const email = "demo@aliquo.com";
  const passwordHash = await bcrypt.hash("demo123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Usuário Demo", passwordHash },
  });

  const planoPro = await prisma.plano.findUnique({ where: { codigo: "pro" } });
  if (planoPro) {
    await prisma.assinatura.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, planoId: planoPro.id, status: "ativa" },
    });
  }

  const temEmpresa = await prisma.empresa.count({ where: { userId: user.id } });
  if (temEmpresa === 0) {
    await prisma.empresa.create({
      data: {
        userId: user.id,
        nome: "Importadora Demo Ltda",
        regimeTributario: "lucro_real",
        ufPadrao: "SP",
        padrao: true,
      },
    });
  }

  const jaTemDespachantes = await prisma.despachante.count({ where: { userId: user.id } });
  if (jaTemDespachantes === 0) {
    await prisma.despachante.createMany({
      data: [
        {
          userId: user.id,
          nome: "Despachante Santos & Cia",
          cnpj: "12.345.678/0001-90",
          contato: "contato@santoscia.com.br",
          honorarios: 850,
        },
        {
          userId: user.id,
          nome: "ComexFast Assessoria",
          cnpj: "98.765.432/0001-10",
          contato: "(11) 4002-8922",
          honorarios: 1200,
        },
      ],
    });
  }

  const jaTemCustos = await prisma.custoRecorrente.count({ where: { userId: user.id } });
  if (jaTemCustos === 0) {
    await prisma.custoRecorrente.createMany({
      data: [
        { userId: user.id, tipo: "siscomex", descricao: "Taxa Siscomex (DI padrão)", valor: 214.5 },
        { userId: user.id, tipo: "thc", descricao: "THC porto de Santos", valor: 1150 },
        {
          userId: user.id,
          tipo: "armazenagem",
          descricao: "Armazenagem alfandegada (estimativa)",
          valor: 600,
        },
      ],
    });
  }

  console.log(`Seed concluído.`);
  console.log(`  planos: ${PLANOS.map((p) => p.codigo).join(", ")}`);
  console.log(`  ICMS: ${Object.keys(ICMS_POR_UF).length} UFs`);
  console.log(`  usuário demo: ${email} / senha: demo123 (plano pro)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
