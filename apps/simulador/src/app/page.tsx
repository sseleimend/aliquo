import Link from "next/link";
import { Footer } from "@/components/Footer";

/**
 * Página pública.
 *
 * A promessa do produto é conferibilidade, então a página mostra o dado real
 * em vez de prometer com adjetivos: o código, o texto oficial, a alíquota e o
 * ato que a fixou. A prova é a própria amostra do documento.
 */

const NUMEROS = [
  { valor: "10.515", rotulo: "NCMs de 8 dígitos" },
  { valor: "100%", rotulo: "com II e IPI oficiais" },
  { valor: "PTAX", rotulo: "câmbio do dia útil anterior" },
];

const PILARES = [
  {
    titulo: "A classificação vem da base, não do modelo",
    texto:
      "A busca recupera candidatos reais da nomenclatura publicada e a IA só ordena o que foi recuperado. Nenhum código é apresentado sem existir na base.",
  },
  {
    titulo: "Sem alíquota oficial, não há número",
    texto:
      "Quando falta dado publicado para um código, o cálculo é bloqueado em vez de estimado. Um custo que não dá para justificar não serve para decidir.",
  },
  {
    titulo: "Cada linha aponta para a sua fonte",
    texto:
      "Alíquota, base legal, ato normativo, data da base e cotação usada acompanham o resultado — na tela e no PDF.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Topo */}
      <header className="border-b border-fio bg-folha">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-serifa text-[20px] font-semibold text-tinta">
            Aliquo<span className="text-caneta">.</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn-primary">
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Abertura */}
        <section className="border-b border-fio py-16">
          <p className="secao">Simulador de custo de importação</p>
          <h1 className="mt-4 max-w-3xl font-serifa text-[clamp(30px,5vw,46px)] font-semibold leading-[1.1] tracking-tight text-tinta">
            O custo da sua importação, com a fonte de cada alíquota à vista.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-tinta2">
            Descubra a NCM na base oficial da Receita, calcule II, IPI, PIS, COFINS e ICMS com
            as alíquotas publicadas, e chegue ao custo total de nacionalização — sabendo de onde
            veio cada número.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastro" className="btn-primary">
              Criar conta grátis
            </Link>
            <Link href="/login" className="btn-secondary">
              Já tenho conta
            </Link>
          </div>

          <dl className="mt-12 grid gap-px overflow-hidden rounded border border-fio bg-fio sm:grid-cols-3">
            {NUMEROS.map((n) => (
              <div key={n.rotulo} className="bg-folha px-5 py-4">
                <dt className="font-mono text-[22px] font-medium leading-none text-tinta">
                  {n.valor}
                </dt>
                <dd className="mt-1.5 text-[12px] text-fraco">{n.rotulo}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Amostra do documento — a prova */}
        <section className="border-b border-fio py-14">
          <p className="secao">Como o resultado se apresenta</p>
          <div className="painel mt-4 overflow-hidden">
            <div className="painel-titulo">
              <span className="font-mono text-[15px] font-semibold text-tinta">8508.11.00</span>
              <span className="selo-visto">confirmado</span>
            </div>
            <p className="border-b border-fio bg-papel2/60 px-5 py-2.5 text-[11.5px] leading-relaxed text-tinta2">
              <span className="secao">Texto oficial</span>
              <br />
              Aspiradores. &gt; Com motor elétrico incorporado: &gt; De potência não superior a
              1.500 W e cujo volume do reservatório não exceda 20 l
            </p>
            <div className="overflow-x-auto">
              <table className="tabela min-w-[520px]">
                <thead>
                  <tr>
                    <th>Tributo</th>
                    <th className="w-[90px] text-right">Alíquota</th>
                    <th className="w-[180px]">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-tinta">Imposto de Importação</td>
                    <td className="text-right font-mono text-tinta">20%</td>
                    <td className="text-[11.5px] text-fraco">TEC — Res. Gecex 272/2021</td>
                  </tr>
                  <tr>
                    <td className="text-tinta">IPI — Importação</td>
                    <td className="text-right font-mono text-tinta">6,5%</td>
                    <td className="text-[11.5px] text-fraco">TIPI — Decreto 11.158/2022</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-fio px-5 py-2.5 text-[11px] text-fraco">
              Base: Resolução Gecex nº 926/2026 · câmbio PTAX de venda do dia útil anterior
            </p>
          </div>
        </section>

        {/* Pilares */}
        <section className="py-14">
          <div className="grid gap-8 sm:grid-cols-3">
            {PILARES.map((p, i) => (
              <div key={p.titulo}>
                <span className="font-mono text-[12px] text-caneta">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 font-serifa text-[17px] font-semibold leading-snug text-tinta">
                  {p.titulo}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-tinta2">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
