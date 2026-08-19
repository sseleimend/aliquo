import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBRL, formatData } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import { AcoesImportacao } from "@/components/historico/AcoesImportacao";
import { ImportarHistorico } from "@/components/historico/ImportarHistorico";

export default async function HistoricoPage() {
  const userId = await getUserId();
  const importacoes = userId
    ? await prisma.importacao.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { itens: { select: { ncm: true, descricaoProduto: true }, orderBy: { ordem: "asc" } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Histórico de importações</h1>
          <p className="text-sm text-ink2">
            Cada simulação guarda as alíquotas, o câmbio e a versão das regras usadas.
          </p>
        </div>
        <Link href="/simulador?novo=1" className="btn-primary">
          Nova simulação
        </Link>
      </div>

      <ImportarHistorico />

      {importacoes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nenhuma importação ainda.{" "}
          <Link href="/simulador?novo=1" className="text-accent-text hover:underline">
            Faça a primeira.
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">NCM</th>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">UF</th>
                <th className="px-4 py-3 text-right font-semibold">Landed cost</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {importacoes.map((imp) => (
                <tr key={imp.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink2">{formatData(imp.createdAt)}</td>
                  <td className="px-4 py-3 font-mono">
                    {imp.itens[0] ? formatarNcm(imp.itens[0].ncm) : "—"}
                    {imp.itens.length > 1 && (
                      <span className="ml-1 text-xs text-muted">+{imp.itens.length - 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink2">
                    {imp.apelido ?? imp.itens[0]?.descricaoProduto ?? "—"}
                  </td>
                  <td className="px-4 py-3">{imp.uf}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatBRL(imp.landedCost)}
                    {imp.provisorio && (
                      <span className="badge ml-2 bg-danger-bg text-danger-text">provisório</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AcoesImportacao id={imp.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
