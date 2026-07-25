import Link from "next/link";
import { auth } from "@/lib/auth";
import { Footer } from "@/components/Footer";

const modulos = [
  {
    tag: "A",
    titulo: "Descoberta de NCM via IA",
    desc: "Informe o NCM ou descreva o produto — a IA refina em até 5 perguntas e sugere 2 a 3 candidatos.",
  },
  {
    tag: "B",
    titulo: "Simulador tributário",
    desc: "II, IPI, PIS/COFINS-Importação, CBS (teste) e ICMS por UF, com câmbio automático.",
  },
  {
    tag: "C",
    titulo: "Landed cost",
    desc: "Soma tributos e custos variáveis (frete, THC, armazenagem, despachante) no custo total de nacionalização.",
  },
  {
    tag: "D",
    titulo: "Despachantes & custos recorrentes",
    desc: "Salve cadastros para reaproveitar nas simulações, com log de auditoria.",
  },
  {
    tag: "E",
    titulo: "Resultado & exportação",
    desc: "Breakdown detalhado na tela e exportação em PDF e Excel.",
  },
];

export default async function Home() {
  const session = await auth();
  const ctaHref = session?.user ? "/simulador" : "/cadastro";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold text-accent-text">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white">A</span>
            Aliquo
          </span>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost text-sm">
              Entrar
            </Link>
            <Link href={ctaHref} className="btn-primary text-sm">
              Começar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Protótipo · Simulador Tributário e Landed Cost
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-ink">
            Classifique o NCM, calcule os tributos e o custo total de nacionalização.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-ink2">
            Para pequenas empresas que importam — ou querem começar. Menos planilha manual, menos
            erro de classificação, sempre com verificação humana antes de decidir.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href={ctaHref} className="btn-primary">
              {session?.user ? "Ir para o simulador" : "Criar conta grátis"}
            </Link>
            <Link href="/login" className="btn-secondary">
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <div key={m.tag} className="card p-5">
              <span className="badge bg-accent-bg text-accent-text">Módulo {m.tag}</span>
              <h3 className="mt-3 text-base font-semibold text-ink">{m.titulo}</h3>
              <p className="mt-1 text-sm text-ink2">{m.desc}</p>
            </div>
          ))}
        </section>

        <Footer />
      </main>
    </div>
  );
}
