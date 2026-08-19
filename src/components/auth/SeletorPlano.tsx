"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

/**
 * Seleção de plano no cadastro (RF-E1).
 *
 * SEM COBRANÇA ainda: escolher um plano pago aqui apenas atribui os limites,
 * o que permite criar contas de teste em tiers diferentes. Quando um gateway
 * entrar, os planos pagos passam por checkout antes da atribuição — o aviso
 * na tela existe para que ninguém confunda isso com uma assinatura real.
 */

export interface PlanoUi {
  codigo: string;
  nome: string;
  precoMensalCentavos: number;
  limites: {
    simulacoesMes?: number;
    itensPorImportacao?: number;
    ncmChatMes?: number;
    exportPdf?: boolean;
    invoiceUpload?: boolean;
  };
}

function linhasDoPlano(l: PlanoUi["limites"]): string[] {
  const ilimitado = (n?: number) => (n === 0 ? "ilimitadas" : String(n ?? "—"));
  return [
    `${ilimitado(l.simulacoesMes)} simulações/mês`,
    `${l.itensPorImportacao ?? "—"} ${l.itensPorImportacao === 1 ? "item" : "itens"} por importação`,
    `${l.ncmChatMes === 0 ? "ilimitadas" : (l.ncmChatMes ?? "—")} classificações por IA/mês`,
    l.exportPdf ? "exportação PDF e Excel" : "sem exportação",
    l.invoiceUpload ? "anexo de fatura" : "sem anexo de fatura",
  ];
}

export function SeletorPlano({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (codigo: string) => void;
}) {
  const [planos, setPlanos] = useState<PlanoUi[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/planos");
        if (res.ok) {
          const lista: PlanoUi[] = (await res.json()).planos ?? [];
          setPlanos(lista);
          if (!valor && lista[0]) onChange(lista[0].codigo);
        }
      } catch {
        /* sem planos, o cadastro segue e cai no gratuito */
      } finally {
        setCarregando(false);
      }
    })();
    // Só na montagem: recarregar a lista trocaria a escolha do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) return <p className="text-xs text-muted">Carregando planos…</p>;
  if (planos.length === 0) return null;

  return (
    <div>
      <p className="label">Escolha seu plano</p>

      <div className="space-y-2">
        {planos.map((p) => {
          const escolhido = valor === p.codigo;
          const gratuito = p.precoMensalCentavos === 0;
          return (
            <button
              key={p.codigo}
              type="button"
              onClick={() => onChange(p.codigo)}
              aria-pressed={escolhido}
              className={`w-full rounded-xl border p-3 text-left transition ${
                escolhido
                  ? "border-accent-border bg-accent-bg"
                  : "border-line bg-white hover:border-accent-border"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{p.nome}</span>
                <span className="text-sm font-semibold text-accent-text">
                  {gratuito ? "Grátis" : `${formatBRL(p.precoMensalCentavos / 100)}/mês`}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                {linhasDoPlano(p.limites).map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <p className="mt-2 rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn-text">
        <strong>Sem cobrança nesta fase.</strong> O plano escolhido é aplicado direto na conta,
        para você testar os limites de cada tier. A integração de pagamento entra depois.
      </p>
    </div>
  );
}
