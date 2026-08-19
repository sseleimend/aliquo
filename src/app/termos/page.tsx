import Link from "next/link";

export const metadata = { title: "Termos de uso — Aliquo" };

/**
 * RNF-4 — blindagem jurídica.
 *
 * O ponto central destes termos é deixar explícito que a decisão de
 * classificação fiscal é do importador. O produto entrega candidatos
 * ancorados na base oficial e mostra a fonte; ele não emite parecer.
 *
 * Texto base — deve passar por revisão jurídica antes de operação comercial.
 */
export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-accent-text hover:underline">
        ← Voltar
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-ink">Termos de uso</h1>
      <p className="mt-1 text-sm text-muted">Última atualização: agosto de 2026.</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink2">
        <section>
          <h2 className="text-base font-bold text-ink">1. O que o Aliquo faz</h2>
          <p className="mt-1">
            O Aliquo é uma ferramenta de <strong>simulação</strong> de custo de importação.
            Ele recupera classificações da Nomenclatura Comum do Mercosul a partir das bases
            públicas publicadas pelos órgãos oficiais, aplica alíquotas dessas mesmas bases e
            estima o custo total de nacionalização.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">2. O que o Aliquo não é</h2>
          <p className="mt-1">
            O Aliquo <strong>não</strong> emite classificação fiscal oficial, parecer tributário,
            consultoria contábil ou jurídica. As sugestões de NCM são candidatos recuperados da
            base oficial, apresentados com o respectivo texto legal para que você decida.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">3. Responsabilidade pela classificação</h2>
          <p className="mt-1">
            A classificação fiscal da mercadoria é <strong>responsabilidade exclusiva do
            importador</strong>. Nenhuma NCM entra no cálculo sem confirmação explícita sua. Ao
            confirmar, você declara que verificou o texto oficial apresentado e assume a decisão.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">4. Limites dos dados</h2>
          <p className="mt-1">
            As bases oficiais são atualizadas periodicamente e o Aliquo indica, em cada
            simulação, o ato normativo e a data da base utilizada. Alíquotas estaduais de ICMS
            são estimativas gerais e não capturam benefícios ou regimes especiais de importação
            de cada estado. Quando não há alíquota oficial carregada para um código, o sistema
            <strong> bloqueia o cálculo</strong> em vez de estimar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">5. Limitação de responsabilidade</h2>
          <p className="mt-1">
            O Aliquo é fornecido no estado em que se encontra. Não nos responsabilizamos por
            multas, tributos, autuações, perdas ou decisões comerciais tomadas com base nas
            simulações. Recomendamos a validação com despachante aduaneiro ou profissional
            habilitado antes de qualquer operação.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">6. Conta e uso</h2>
          <p className="mt-1">
            Você é responsável por manter a confidencialidade das suas credenciais. Os planos e
            limites de uso vigentes são os exibidos na sua conta.
          </p>
        </section>
      </div>
    </main>
  );
}
