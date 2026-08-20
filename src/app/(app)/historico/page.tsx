import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBRL, formatData } from "@/lib/format";
import { formatarNcm } from "@/lib/ncm/codigo";
import { calcularIndicadores } from "@/lib/historico/indicadores";
import { CabecalhoPagina } from "@/components/app/CabecalhoPagina";
import { AcoesImportacao } from "@/components/historico/AcoesImportacao";
import { ImportarHistorico } from "@/components/historico/ImportarHistorico";

export default async function HistoricoPage() {
  const userId = await getUserId();
  const importacoes = userId
    ? await prisma.importacao.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          itens: { select: { ncm: true, descricaoProduto: true }, orderBy: { ordem: "asc" } },
        },
      })
    : [];

  const ind = calcularIndicadores(importacoes);

  return (
    <>
      <CabecalhoPagina
        titulo="Histórico de importações"
        descricao="Cada registro guarda as alíquotas, o câmbio e a versão das regras que produziram o número."
        acoes={
          <Link href="/simulador?novo=1" className="btn-primary">
            Nova simulação
          </Link>
        }
      />

      {/* Tiras de resumo — números do documento, não cartões decorativos. */}
      {importacoes.length > 0 && (
        <div className="mb-6 grid gap-px overflow-hidden rounded border border-fio bg-fio sm:grid-cols-3">
          <Resumo rotulo="Importações" valor={String(ind.total)} />
          <Resumo
            rotulo="Custo acumulado"
            valor={formatBRL(ind.custoAcumulado)}
            nota={ind.notaCusto}
          />
          <Resumo
            rotulo="Provisórias"
            valor={String(ind.provisorias)}
            alerta={ind.alerta}
            nota={ind.notaProvisorias}
          />
        </div>
      )}

      <div className="mb-6">
        <ImportarHistorico />
      </div>

      {importacoes.length === 0 ? (
        <div className="painel">
          <div className="px-6 py-12 text-center">
            <p className="font-serifa text-[17px] text-tinta">Nenhuma importação registrada</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-tinta2">
              Faça a primeira simulação, ou traga seu histórico de outra ferramenta pela
              planilha acima.
            </p>
            <Link href="/simulador?novo=1" className="btn-primary mt-5">
              Começar uma simulação
            </Link>
          </div>
        </div>
      ) : (
        <div className="painel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabela min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[130px]">Data</th>
                  <th className="w-[120px]">NCM</th>
                  <th>Produto</th>
                  <th className="w-[56px]">UF</th>
                  <th className="w-[150px] text-right">Landed cost</th>
                  <th className="w-[230px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {importacoes.map((imp) => (
                  <tr key={imp.id}>
                    <td className="whitespace-nowrap text-tinta2">{formatData(imp.createdAt)}</td>
                    <td>
                      <span className="codigo">
                        {imp.itens[0] ? formatarNcm(imp.itens[0].ncm) : "—"}
                      </span>
                      {imp.itens.length > 1 && (
                        <span className="ml-1.5 text-[11px] text-fraco">
                          +{imp.itens.length - 1}
                        </span>
                      )}
                    </td>
                    <td className="text-tinta2">
                      <span className="line-clamp-2">
                        {imp.apelido ?? imp.itens[0]?.descricaoProduto ?? "—"}
                      </span>
                    </td>
                    <td className="text-tinta2">{imp.uf}</td>
                    <td className="text-right">
                      <span className="font-mono text-[13.5px] font-medium text-tinta">
                        {formatBRL(imp.landedCost)}
                      </span>
                      {imp.provisorio && (
                        <span className="selo-carimbo ml-2">provisório</span>
                      )}
                    </td>
                    <td className="text-right">
                      <AcoesImportacao id={imp.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Resumo({
  rotulo,
  valor,
  nota,
  alerta,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-folha px-5 py-4">
      <p className="secao">{rotulo}</p>
      <p
        className={`mt-1.5 font-mono text-[21px] font-medium leading-none ${
          alerta ? "text-carimbo" : "text-tinta"
        }`}
      >
        {valor}
      </p>
      {nota && <p className="mt-1.5 text-[11.5px] text-fraco">{nota}</p>}
    </div>
  );
}
