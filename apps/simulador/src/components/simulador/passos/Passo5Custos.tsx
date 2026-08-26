"use client";

import { useEffect, useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { formatBRL } from "@/lib/format";
import { IcmsDeclaracao } from "../IcmsDeclaracao";
import { useSimulador } from "../SimuladorProvider";
import { numero, type Rascunho } from "../rascunho";

interface CustoSalvo {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
}
interface DespachanteSalvo {
  id: string;
  nome: string;
  honorarios: number;
}

const CAMPOS: Array<{ campo: keyof Rascunho; rotulo: string; nota?: string }> = [
  { campo: "siscomex", rotulo: "Taxa Siscomex", nota: "Entra na base do ICMS" },
  { campo: "afrmm", rotulo: "AFRMM (frete marítimo)", nota: "Entra na base do ICMS" },
  { campo: "thc", rotulo: "THC (capatazia)" },
  { campo: "armazenagem", rotulo: "Armazenagem" },
  { campo: "despachante", rotulo: "Honorários de despachante" },
  { campo: "outrosCustos", rotulo: "Outros custos" },
];

/** Passo 5 — custos que não compõem o valor aduaneiro (RF-C3). */
export function Passo5Custos() {
  const { estado, despachar } = useSimulador();
  const [custos, setCustos] = useState<CustoSalvo[]>([]);
  const [despachantes, setDespachantes] = useState<DespachanteSalvo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [rc, rd] = await Promise.all([fetch("/api/custos"), fetch("/api/despachantes")]);
        if (rc.ok) setCustos((await rc.json()).custos ?? []);
        if (rd.ok) setDespachantes((await rd.json()).despachantes ?? []);
      } catch {
        /* atalhos são opcionais */
      }
    })();
  }, []);

  const mapaCampo: Record<string, keyof Rascunho> = {
    siscomex: "siscomex",
    afrmm: "afrmm",
    thc: "thc",
    armazenagem: "armazenagem",
    frete: "freteInternacional",
    outro: "outrosCustos",
  };

  return (
    <div className="space-y-5">
      {(custos.length > 0 || despachantes.length > 0) && (
        <div>
          <p className="label">Preencher a partir dos seus cadastros</p>
          <div className="flex flex-wrap gap-2">
            {despachantes.map((d) => (
              <button
                key={d.id}
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  despachar({ tipo: "campo", campo: "despachante", valor: String(d.honorarios) })
                }
              >
                {d.nome} · {formatBRL(d.honorarios)}
              </button>
            ))}
            {custos.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  const campo = mapaCampo[c.tipo] ?? "outrosCustos";
                  despachar({ tipo: "campo", campo, valor: String(c.valor) });
                }}
              >
                {c.descricao} · {formatBRL(c.valor)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(({ campo, rotulo, nota }) => (
          <div key={campo}>
            <label className="label" htmlFor={String(campo)}>
              {rotulo}
            </label>
            <MoneyInput
              id={String(campo)}
              value={numero(estado[campo] as string)}
              onValueChange={(n) => despachar({ tipo: "campo", campo, valor: String(n) })}
            />
            {nota && <p className="mt-1 text-xs text-fraco">{nota}</p>}
          </div>
        ))}
      </div>

      <p className="text-xs text-fraco">
        Estes custos entram no custo total de nacionalização. Siscomex e AFRMM também compõem a
        base do ICMS, por isso aparecem separados dos demais no resultado.
      </p>

      <IcmsDeclaracao />
    </div>
  );
}
