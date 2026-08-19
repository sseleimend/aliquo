import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { consumirCota, QuotaExcedidaError } from "@/lib/plans";
import { ArquivoInvalidoError } from "@/lib/storage";
import { importarEmbarques } from "@/lib/migracao/importar";
import { extrairPayloadPdf, payloadParaEmbarque } from "@/lib/migracao/payload";
import { lerPlanilha, type EmbarqueImportado } from "@/lib/migracao/template";

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/**
 * Importa histórico a partir de uma planilha preenchida ou de um PDF/Excel
 * gerado pelo próprio Aliquo.
 *
 * PDF de OUTRA ferramenta é recusado com uma mensagem explícita: extrair
 * números confiáveis de um layout arbitrário é adivinhação, e adivinhar valor
 * fiscal é o oposto do que este produto faz. Para esses casos existe a planilha.
 */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let arquivo: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("arquivo");
    arquivo = f instanceof File && f.size > 0 ? f : null;
  } catch {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }

  if (!arquivo) return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 400 });
  }

  const dados = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();
  const ehPdf = nome.endsWith(".pdf") || arquivo.type === "application/pdf";

  let embarques: EmbarqueImportado[] = [];
  let erros: Array<{ linha: number; campo: string; mensagem: string }> = [];

  try {
    if (ehPdf) {
      const payload = extrairPayloadPdf(dados);
      if (!payload) {
        return NextResponse.json(
          {
            error:
              "Este PDF não foi gerado pelo Aliquo, então não carrega os dados da importação. " +
              "Para migrar de outra ferramenta, baixe o modelo de planilha e preencha — é o " +
              "caminho que garante números conferíveis.",
            baixarTemplate: true,
          },
          { status: 422 },
        );
      }
      embarques = [payloadParaEmbarque(payload, payload.apelido || "Importação migrada")];
    } else {
      const r = await lerPlanilha(dados);
      embarques = r.embarques;
      erros = r.erros;
    }
  } catch (e) {
    if (e instanceof ArquivoInvalidoError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Confira se é a planilha do modelo ou um PDF do Aliquo." },
      { status: 400 },
    );
  }

  if (embarques.length === 0) {
    return NextResponse.json(
      {
        error: erros.length
          ? "Nenhuma linha válida encontrada."
          : "A planilha está vazia — preencha ao menos uma linha.",
        erros,
      },
      { status: 422 },
    );
  }

  // Cada embarque migrado consome uma unidade de cota, como uma simulação.
  try {
    for (let i = 0; i < embarques.length; i++) await consumirCota(userId, "simulacao");
  } catch (e) {
    if (e instanceof QuotaExcedidaError) {
      return NextResponse.json(
        {
          error: `${e.message} A planilha tem ${embarques.length} importação(ões).`,
          upgrade: true,
        },
        { status: 402 },
      );
    }
    throw e;
  }

  const resultado = await importarEmbarques(userId, embarques);

  return NextResponse.json({
    criadas: resultado.criadas.length,
    falhas: resultado.falhas,
    erros,
    detalhes: resultado.criadas,
  });
}
