import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBRL, formatData } from "@/lib/format";

export default async function HistoricoPage() {
  const userId = await getUserId();
  const simulacoes = userId
    ? await prisma.simulacao.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Histórico de simulações</h1>
          <p className="text-sm text-ink2">Simulações salvas na sua conta.</p>
        </div>
        <Link href="/simulador" className="btn-primary">
          Nova simulação
        </Link>
      </div>

      {simulacoes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nenhuma simulação ainda.{" "}
          <Link href="/simulador" className="text-accent-text hover:underline">
            Faça a primeira.
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">NCM</th>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">UF</th>
                <th className="px-4 py-3 text-right font-semibold">Landed cost</th>
                <th className="px-4 py-3 text-right font-semibold">Exportar</th>
              </tr>
            </thead>
            <tbody>
              {simulacoes.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink2">{formatData(s.createdAt)}</td>
                  <td className="px-4 py-3 font-mono">{s.ncm}</td>
                  <td className="px-4 py-3 text-ink2">{s.descricaoProduto ?? "—"}</td>
                  <td className="px-4 py-3">{s.uf}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatBRL(s.landedCost)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a className="text-accent-text hover:underline" href={`/api/export/pdf?id=${s.id}`}>
                      PDF
                    </a>
                    <span className="mx-1 text-line">·</span>
                    <a className="text-accent-text hover:underline" href={`/api/export/excel?id=${s.id}`}>
                      Excel
                    </a>
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
