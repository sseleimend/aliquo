import Link from "next/link";

export const metadata = { title: "Política de privacidade — Aliquo" };

/**
 * RNF-4 — texto base de privacidade (LGPD).
 * Deve passar por revisão jurídica antes de operação comercial.
 */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-accent-text hover:underline">
        ← Voltar
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-ink">Política de privacidade</h1>
      <p className="mt-1 text-sm text-muted">Última atualização: agosto de 2026.</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink2">
        <section>
          <h2 className="text-base font-bold text-ink">1. Dados que coletamos</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Cadastro:</strong> nome, e-mail e senha (armazenada apenas como hash) ou os
              dados do provedor de login social que você escolher.
            </li>
            <li>
              <strong>Operacionais:</strong> descrições de produto, NCMs confirmadas, valores,
              custos e resultados das simulações que você cria.
            </li>
            <li>
              <strong>Uso:</strong> contagem de simulações e consultas, para aplicar os limites do
              seu plano e medir o custo de operação.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">2. Para que usamos</h2>
          <p className="mt-1">
            Para operar o serviço, manter seu histórico de importações, aplicar os limites do
            plano contratado e melhorar a qualidade das sugestões de classificação.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">3. Compartilhamento com terceiros</h2>
          <p className="mt-1">
            Descrições de produto podem ser enviadas a um provedor de modelo de linguagem para
            traduzir o texto ao vocabulário técnico da nomenclatura e ordenar candidatos.{" "}
            <strong>Não enviamos valores, custos, dados da sua empresa nem resultados</strong> —
            apenas o texto do produto. Consultamos ainda fontes públicas de câmbio (Banco Central
            e provedor de mercado), sem enviar dados pessoais.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">4. Retenção e exclusão</h2>
          <p className="mt-1">
            Seus dados permanecem enquanto a conta existir. Você pode excluir simulações
            individualmente e solicitar a exclusão da conta e de todos os dados associados pelo
            e-mail de suporte.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-ink">5. Seus direitos (LGPD)</h2>
          <p className="mt-1">
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados
            pessoais, bem como revogar consentimentos, entrando em contato pelo suporte.
          </p>
        </section>
      </div>
    </main>
  );
}
