import { SimuladorClient } from "@/components/simulador/SimuladorClient";
import { prisma } from "@/lib/db";

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string; novo?: string }>;
}) {
  const { duplicar, novo } = await searchParams;

  // Ato e vigência da base carregada — exibidos junto de cada sugestão (RNF-1).
  const base = await prisma.baseVersao.findFirst({
    where: { tipo: "nomenclatura", ativa: true },
    select: { ato: true, vigenteEm: true },
  });

  return (
    <SimuladorClient
      baseAto={base ? `${base.ato} — ${base.vigenteEm}` : undefined}
      duplicarDe={duplicar}
      comecarLimpo={novo === "1"}
    />
  );
}
