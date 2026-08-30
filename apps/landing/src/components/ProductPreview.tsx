import { ChevronsUpDown, FileSpreadsheet, LayoutGrid, Plus, Truck, User } from "lucide-react";

/**
 * Mockup ilustrativo do simulador — dados de exemplo, não é tela de cliente
 * real. Mantém a mesma NCM/amostra usada na home pública do app
 * (apps/simulador) para consistência de marca.
 */
const SIDEBAR_NAV = [
  { icon: LayoutGrid, label: "Nova simulação" },
  { icon: FileSpreadsheet, label: "Histórico", active: true },
  { icon: Truck, label: "Despachantes", badge: "2" },
  { icon: User, label: "Conta" },
];

const RECENTES = ["Aspirador de pó portátil", "Bicicleta elétrica dobrável", "Placas solares fotovoltaicas"];

const STATS = [
  { label: "Custo total nacionalizado", value: "R$ 428.750,00", delta: "+12% vs. mês anterior" },
  { label: "NCMs confirmados", value: "18", delta: "3 aguardando revisão" },
  { label: "Simulações este mês", value: "37", delta: "63 restantes no plano" },
];

const ROWS: { produto: string; ncm: string; status: "Confirmado" | "Em revisão" | "Bloqueado"; cambio: string; custo: string }[] = [
  { produto: "Aspirador de pó portátil", ncm: "8508.11.00", status: "Em revisão", cambio: "R$ 5,42", custo: "R$ 42.180,00" },
  { produto: "Bicicleta elétrica dobrável", ncm: "8711.60.00", status: "Confirmado", cambio: "R$ 5,39", custo: "R$ 128.450,00" },
  { produto: "Placas solares fotovoltaicas", ncm: "8541.43.00", status: "Bloqueado", cambio: "R$ 5,44", custo: "—" },
  { produto: "Luminárias de LED", ncm: "9405.42.00", status: "Confirmado", cambio: "R$ 5,40", custo: "R$ 27.640,00" },
  { produto: "Componentes eletrônicos", ncm: "8542.31.00", status: "Em revisão", cambio: "R$ 5,43", custo: "R$ 64.870,00" },
  { produto: "Ferramentas manuais (kit)", ncm: "8205.59.00", status: "Confirmado", cambio: "R$ 5,42", custo: "R$ 15.320,00" },
];

const STATUS_STYLE: Record<string, string> = {
  Confirmado: "bg-positive-soft text-positive",
  "Em revisão": "bg-accent-soft text-accent",
  Bloqueado: "bg-warn-soft text-warn",
};

export function ProductPreview() {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-bg shadow-[0_1px_2px_rgba(11,11,15,0.06),0_24px_48px_-12px_rgba(11,11,15,0.12)]">
      {/* Sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-bg-subtle p-4 sm:flex">
        <div className="flex items-center gap-2 rounded-sm border border-border px-2.5 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
            S
          </span>
          <span className="flex-1 truncate text-[13px] font-medium text-text-primary">Sua empresa</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
        </div>

        <nav className="mt-4 flex flex-col gap-0.5">
          {SIDEBAR_NAV.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] ${
                item.active ? "bg-surface2 font-medium text-text-primary" : "text-text-secondary"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        <p className="mt-5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
          Simulações recentes
        </p>
        <div className="mt-1 flex flex-col gap-0.5">
          {RECENTES.map((r) => (
            <div key={r} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-text-secondary">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="truncate">{r}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-sm border border-border bg-bg p-3">
          <p className="text-[12.5px] font-medium text-text-primary">37 de 100 simulações usadas este mês</p>
          <div className="mt-2 h-1 w-full rounded-full bg-surface2">
            <div className="h-1 rounded-full bg-accent" style={{ width: "37%" }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-hidden p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-text-primary">Histórico de importações</h3>
            <span className="text-[13px] text-text-tertiary">24</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white">
            <Plus className="h-3.5 w-3.5" />
            Nova simulação
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-sm border border-border p-3">
              <p className="text-[11.5px] text-text-tertiary">{s.label}</p>
              <p className="mt-1 text-[17px] font-semibold text-text-primary">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">{s.delta}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-sm border border-border">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-bg-subtle text-[10.5px] uppercase tracking-wide text-text-tertiary">
                <th className="px-3 py-2 font-semibold">Produto</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">NCM</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">Câmbio</th>
                <th className="px-3 py-2 text-right font-semibold">Custo total</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.produto} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5 text-text-primary">{r.produto}</td>
                  <td className="hidden px-3 py-2.5 text-text-secondary sm:table-cell">{r.ncm}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {r.status}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-text-secondary md:table-cell">{r.cambio}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-text-primary">{r.custo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
