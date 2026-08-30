import { Banknote, Ban, FileSpreadsheet, Lock, ShieldCheck, XCircle } from "lucide-react";

const OBJECOES = [
  {
    icon: Banknote,
    titulo: "Sem cartão para começar",
    desc: "O plano Gratuito não pede cartão. Você testa 5 simulações por mês sem compromisso.",
  },
  {
    icon: Lock,
    titulo: "Seus dados de importação continuam seus",
    desc: "Suas faturas e simulações ficam na sua conta. A descrição do produto pode passar por um provedor de IA só para ajudar a localizar a NCM — o código final vem sempre da base oficial, nunca do modelo.",
  },
  {
    icon: FileSpreadsheet,
    titulo: "Nada para migrar",
    desc: "Já importa por planilha? Baixe o modelo, preencha e anexe. O landed cost antigo fica só como referência; os tributos são recalculados com as alíquotas de hoje.",
  },
  {
    icon: Ban,
    titulo: "Sem contrato de fidelidade",
    desc: "Mude de plano ou cancele quando fizer sentido para o seu volume — é só pedir.",
  },
  {
    icon: XCircle,
    titulo: "Nenhuma alíquota inventada",
    desc: "Sem base oficial publicada para o seu NCM, o Aliquo bloqueia o cálculo em vez de estimar. Você nunca decide sem saber a fonte.",
  },
  {
    icon: ShieldCheck,
    titulo: "Cobertura da base, sem esconder o limite",
    desc: "10.515 NCMs de 8 dígitos, 100% com II e IPI oficiais. ICMS por UF ainda é estimativa — e isso aparece marcado no seu resultado, não escondido.",
  },
];

const TRUST_BAR = [
  "Fonte: Receita Federal, Siscomex e Gecex/MDIC",
  "Câmbio oficial PTAX/BCB",
  "Cálculo reproduzível — versão da base e das regras registrada",
  "Sem alíquota inventada",
];

export function Objections() {
  return (
    <section className="border-b border-border px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">
          <span className="eyebrow-dot" />ANTES DE CRIAR CONTA
        </span>
        <h2 className="mt-4 max-w-2xl text-[clamp(24px,3.5vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          As respostas que você já ia procurar
        </h2>

        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {OBJECOES.map((o) => (
            <div key={o.titulo}>
              <o.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-[15px] font-semibold text-text-primary">{o.titulo}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{o.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-border pt-8">
          {TRUST_BAR.map((t) => (
            <span key={t} className="flex items-center gap-2 text-[12.5px] text-text-tertiary">
              <ShieldCheck className="h-4 w-4 text-text-tertiary" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
