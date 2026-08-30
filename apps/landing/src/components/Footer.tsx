import { ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { APP_URL } from "@/lib/config";

const COLUNAS = [
  {
    titulo: "Produto",
    links: [
      { label: "Visão geral", href: "#produto" },
      { label: "Classificação de NCM", href: "#recursos" },
      { label: "Motor tributário", href: "#recursos" },
      { label: "Custo total", href: "#recursos" },
      { label: "Histórico e migração", href: "#recursos" },
    ],
  },
  {
    titulo: "Empresa",
    links: [
      { label: "Sobre", href: "#" },
      { label: "Contato", href: "mailto:contato@aliquo.com" },
      { label: "Carreiras", href: "#" },
    ],
  },
  {
    titulo: "Recursos",
    links: [
      { label: "Central de ajuda", href: "mailto:contato@aliquo.com" },
      { label: "Novidades", href: "#" },
    ],
  },
  {
    titulo: "Legal",
    links: [
      { label: "Política de Privacidade", href: `${APP_URL}/privacidade` },
      { label: "Termos de Uso", href: `${APP_URL}/termos` },
    ],
  },
];

export function Footer() {
  return (
    <footer className="px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-text-secondary">
              Aliquo é o simulador de landed cost para importação no Brasil: NCM na base oficial,
              tributos com alíquota publicada, custo total de nacionalização com a fonte de cada
              número.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[12px] text-text-tertiary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fonte oficial Siscomex · TEC · TIPI
              </span>
              <span className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[12px] text-text-tertiary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Câmbio oficial PTAX/BCB
              </span>
            </div>
          </div>

          {COLUNAS.map((col) => (
            <div key={col.titulo}>
              <h3 className="text-[13px] font-semibold text-text-primary">{col.titulo}</h3>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[13.5px] text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-[12.5px] text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Aliquo. Todos os direitos reservados.</p>
          <div className="flex gap-5">
            <a href={`${APP_URL}/privacidade`} className="hover:text-text-primary">
              Política de Privacidade
            </a>
            <a href={`${APP_URL}/termos`} className="hover:text-text-primary">
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
