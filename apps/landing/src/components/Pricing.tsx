import { Check } from "lucide-react";
import { APP_URL } from "@/lib/config";

const PLANOS = [
  {
    codigo: "free",
    nome: "Gratuito",
    preco: "R$ 0",
    desc: "Para testar o cálculo antes de decidir.",
    features: [
      "5 simulações por mês",
      "1 item por importação",
      "20 consultas de NCM por IA/mês",
      "Exportação em PDF",
    ],
    cta: { label: "Criar conta grátis", href: `${APP_URL}/cadastro`, variant: "secondary" as const },
  },
  {
    codigo: "pro",
    nome: "Pro",
    destaque: "Mais usado",
    preco: "R$ 149",
    desc: "Para quem importa com frequência e precisa de mais volume.",
    features: [
      "100 simulações por mês",
      "Até 20 itens por importação",
      "500 consultas de NCM por IA/mês",
      "Upload de fatura comercial",
      "Exportação em PDF e Excel",
    ],
    cta: { label: "Falar com a gente", href: "mailto:contato@aliquo.com", variant: "primary" as const },
  },
  {
    codigo: "business",
    nome: "Business",
    preco: "R$ 499",
    desc: "Para operações com muitos itens e sem limite de simulação.",
    features: [
      "Simulações ilimitadas",
      "Até 200 itens por importação",
      "Consultas de NCM por IA ilimitadas",
      "Upload de fatura comercial + gestão de despachantes",
    ],
    cta: { label: "Falar com a gente", href: "mailto:contato@aliquo.com", variant: "secondary" as const },
  },
];

export function Pricing() {
  return (
    <section id="precos" className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="eyebrow justify-center">
            <span className="eyebrow-dot" />PREÇOS
          </span>
          <h2 className="mx-auto mt-4 max-w-xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
            Um plano para cada volume de importação
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            Preços mensais, sem taxa de adesão. Os valores ainda podem mudar enquanto ajustamos os
            planos ao mercado.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANOS.map((p) => (
            <div
              key={p.codigo}
              className={`flex flex-col rounded-lg border p-6 ${
                p.destaque ? "border-accent shadow-[0_0_0_3px_rgba(74,58,255,0.12)]" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-text-primary">{p.nome}</h3>
                {p.destaque && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    {p.destaque}
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[30px] font-semibold tracking-[-0.02em] text-text-primary">
                  {p.preco}
                </span>
                <span className="text-[13px] text-text-tertiary">por mês</span>
              </p>
              <p className="mt-2 text-[13px] text-text-secondary">{p.desc}</p>

              <a
                href={p.cta.href}
                className={p.cta.variant === "primary" ? "btn-primary mt-5 w-full" : "btn-secondary mt-5 w-full"}
              >
                {p.cta.label}
              </a>

              <ul className="mt-6 flex flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-text-tertiary">
          O plano Gratuito é 100% self-service, sem cartão. A ativação do Pro e do Business é feita
          pela nossa equipe — sem checkout automático por enquanto.
        </p>
      </div>
    </section>
  );
}
