/**
 * Carrega uma importação anterior como rascunho (RF-D2 / RF-D4).
 *
 * Compartilhado pelos dois pontos de entrada do reuso: o botão do histórico
 * (`/simulador?duplicar=<id>`) e o seletor dentro do passo 1. Mesmo mecanismo,
 * duas portas — não duas implementações que podem divergir.
 *
 * Copia apenas a ENTRADA. O resultado antigo fica para trás de propósito:
 * câmbio e alíquotas são resolvidos de novo no cálculo.
 */

import { formatarNcm } from "@/lib/ncm/codigo";
import { novoItem, type AcaoRascunho } from "./rascunho";

export interface ResultadoCarregamento {
  ok: boolean;
  erro: string;
  aviso?: string | null;
}

export async function carregarDeDuplicata(
  id: string,
  despachar: (a: AcaoRascunho) => void,
): Promise<ResultadoCarregamento> {
  try {
    const res = await fetch(`/api/importacoes/${id}/duplicar`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, erro: data.error ?? "Não foi possível carregar a importação." };
    }

    const r = data.rascunho;
    despachar({
      tipo: "carregar",
      duplicadaDeId: data.duplicadaDeId,
      rascunho: {
        apelido: r.apelido ?? "",
        uf: r.uf,
        moeda: r.moeda,
        incoterm: r.incoterm ?? "FOB",
        regimeTributario: r.regimeTributario,
        invoiceId: r.invoiceId ?? null,
        criterioRateio: r.criterioRateio ?? "valor",
        itens: (r.itens ?? []).map((i: Record<string, unknown>) =>
          novoItem({
            ncm: String(i.ncm ?? ""),
            ncmFmt: formatarNcm(String(i.ncm ?? "")),
            ncmDescricaoOficial: (i.ncmDescricaoOficial as string) ?? undefined,
            ncmCaminhoOficial: (i.ncmCaminhoOficial as string) ?? undefined,
            ncmFonte: "reuso",
            confirmado: true,
            descricaoProduto: (i.descricaoProduto as string) ?? "",
            quantidade: String(i.quantidade ?? 1),
            valorUnitarioMoeda: String(i.valorUnitarioMoeda ?? ""),
            pesoLiquidoKg: i.pesoLiquidoKg ? String(i.pesoLiquidoKg) : "",
          }),
        ),
        freteInternacional: String(r.freteInternacional ?? ""),
        seguroInternacional: String(r.seguroInternacional ?? ""),
        siscomex: String(r.siscomex ?? ""),
        afrmm: String(r.afrmm ?? ""),
        thc: String(r.thc ?? ""),
        armazenagem: String(r.armazenagem ?? ""),
        despachante: String(r.despachante ?? ""),
        outrosCustos: String(r.outrosCustos ?? ""),
        // Cai direto na revisão das NCMs: elas vêm confirmadas, mas o usuário
        // precisa vê-las antes de seguir.
        passo: 1,
      },
    });

    return { ok: true, erro: "", aviso: data.aviso ?? null };
  } catch {
    return { ok: false, erro: "Falha de rede ao carregar a importação." };
  }
}
