import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exigirRecurso, RecursoIndisponivelError } from "@/lib/plans";
import {
  ArquivoInvalidoError,
  getFileStore,
  montarChave,
  sha256,
  validarArquivo,
} from "@/lib/storage";

/**
 * RF-D2 — anexo da fatura comercial.
 *
 * A fatura é o COMPROVANTE de uma importação: ela não tem itens digitados à
 * mão. Seus itens são herdados da importação a que ela se vincula, gravados
 * quando a importação é salva (ver /api/importacoes). O reaproveitamento de
 * produtos e NCMs acontece pelo HISTÓRICO, não por um cadastro paralelo.
 */

const metaSchema = z.object({
  numero: z.string().trim().max(120).optional(),
  fornecedor: z.string().trim().max(200).optional(),
  dataEmissao: z.string().trim().max(20).optional(),
  moeda: z.string().trim().min(1).max(6).default("USD"),
  valorTotal: z.coerce.number().min(0).default(0),
});

// GET — invoices do usuário, para reuso.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      itens: { select: { id: true, descricao: true, ncm: true, quantidade: true, valorUnitario: true } },
      _count: { select: { importacoes: true } },
    },
  });

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      numero: i.numero,
      fornecedor: i.fornecedor,
      dataEmissao: i.dataEmissao,
      moeda: i.moeda,
      valorTotal: i.valorTotal,
      arquivoNome: i.arquivoNome,
      temArquivo: Boolean(i.arquivoKey),
      qtdItens: i.itens.length,
      usadaEm: i._count.importacoes,
      itens: i.itens,
      createdAt: i.createdAt,
    })),
  });
}

// POST — cria a invoice. Aceita multipart (com arquivo) ou JSON puro.
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await exigirRecurso(userId, "invoiceUpload");
  } catch (e) {
    if (e instanceof RecursoIndisponivelError) {
      return NextResponse.json({ error: e.message, upgrade: true }, { status: 402 });
    }
    throw e;
  }

  const tipoConteudo = req.headers.get("content-type") ?? "";
  let meta: z.infer<typeof metaSchema>;
  let arquivo: File | null = null;

  try {
    if (tipoConteudo.includes("multipart/form-data")) {
      const form = await req.formData();
      const bruto = form.get("meta");
      meta = metaSchema.parse(bruto ? JSON.parse(String(bruto)) : {});
      const f = form.get("arquivo");
      arquivo = f instanceof File && f.size > 0 ? f : null;
    } else {
      meta = metaSchema.parse(await req.json());
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  let dados: Buffer | null = null;
  let ext = "";
  let hash = "";

  if (arquivo) {
    try {
      ext = validarArquivo(arquivo.type, arquivo.size);
    } catch (e) {
      if (e instanceof ArquivoInvalidoError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
    dados = Buffer.from(await arquivo.arrayBuffer());
    hash = sha256(dados);

    // Mesmo arquivo já enviado antes: avisa em vez de duplicar silenciosamente.
    const jaExiste = await prisma.invoice.findFirst({
      where: { userId, arquivoSha256: hash },
      select: { id: true, numero: true },
    });
    if (jaExiste) {
      return NextResponse.json(
        {
          error: "Este arquivo já foi enviado antes.",
          duplicadaDe: jaExiste.id,
          numero: jaExiste.numero,
        },
        { status: 409 },
      );
    }
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      numero: meta.numero || null,
      fornecedor: meta.fornecedor || null,
      dataEmissao: meta.dataEmissao || null,
      moeda: meta.moeda,
      valorTotal: meta.valorTotal,
      arquivoNome: arquivo?.name ?? null,
      arquivoMime: arquivo?.type ?? null,
      arquivoTamanho: arquivo?.size ?? null,
      arquivoSha256: hash || null,
    },
    select: { id: true },
  });

  // O arquivo é gravado depois de existir o id, para a chave ser estável.
  if (dados) {
    const chave = montarChave(userId, invoice.id, ext);
    try {
      await getFileStore().put(chave, dados, arquivo?.type);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { arquivoKey: chave } });
    } catch {
      // Sem o arquivo a invoice ainda é útil pelos itens; não perdemos o registro.
      return NextResponse.json(
        {
          id: invoice.id,
          aviso: "A fatura foi salva, mas o arquivo não pôde ser armazenado.",
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json({ id: invoice.id }, { status: 201 });
}
