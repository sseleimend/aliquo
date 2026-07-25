"use client";

import { useEffect, useState } from "react";
import { formatBRL, formatData } from "@/lib/format";
import { MoneyInput } from "@/components/MoneyInput";

interface Despachante {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  honorarios: number;
}
interface Custo {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
}
interface Log {
  id: string;
  entidade: string;
  acao: string;
  createdAt: string;
}

const TIPOS = ["frete", "thc", "armazenagem", "siscomex", "afrmm", "outro"];

export function DespachantesClient() {
  const [despachantes, setDespachantes] = useState<Despachante[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  // form despachante
  const [dNome, setDNome] = useState("");
  const [dCnpj, setDCnpj] = useState("");
  const [dContato, setDContato] = useState("");
  const [dHon, setDHon] = useState("");

  // form custo
  const [cTipo, setCTipo] = useState("siscomex");
  const [cDesc, setCDesc] = useState("");
  const [cValor, setCValor] = useState("");

  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const [d, c, l] = await Promise.all([
      fetch("/api/despachantes").then((r) => r.json()),
      fetch("/api/custos").then((r) => r.json()),
      fetch("/api/auditoria").then((r) => r.json()),
    ]);
    setDespachantes(d.despachantes ?? []);
    setCustos(c.custos ?? []);
    setLogs(l.logs ?? []);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function addDespachante(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = await fetch("/api/despachantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: dNome,
        cnpj: dCnpj || null,
        contato: dContato || null,
        honorarios: Number(dHon) || 0,
      }),
    });
    if (!r.ok) {
      setErro((await r.json()).error ?? "Falha ao salvar despachante.");
      return;
    }
    setDNome("");
    setDCnpj("");
    setDContato("");
    setDHon("");
    carregar();
  }

  async function removerDespachante(id: string) {
    await fetch(`/api/despachantes/${id}`, { method: "DELETE" });
    carregar();
  }

  async function addCusto(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = await fetch("/api/custos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: cTipo, descricao: cDesc, valor: Number(cValor) || 0 }),
    });
    if (!r.ok) {
      setErro((await r.json()).error ?? "Falha ao salvar custo.");
      return;
    }
    setCDesc("");
    setCValor("");
    carregar();
  }

  async function removerCusto(id: string) {
    await fetch(`/api/custos/${id}`, { method: "DELETE" });
    carregar();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Despachantes & custos recorrentes</h1>
        <p className="text-sm text-ink2">
          Salve cadastros para reaproveitar nas simulações (RF11). Toda alteração é registrada no log
          de auditoria (RF12).
        </p>
      </div>

      {erro ? (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger-text">{erro}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Despachantes */}
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold text-ink">Despachantes</h2>
          <form onSubmit={addDespachante} className="space-y-2">
            <input className="input" placeholder="Nome do despachante" value={dNome} onChange={(e) => setDNome(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="CNPJ (opcional)" value={dCnpj} onChange={(e) => setDCnpj(e.target.value)} />
              <input className="input" placeholder="Contato (opcional)" value={dContato} onChange={(e) => setDContato(e.target.value)} />
            </div>
            <div>
              <label className="label">Honorário padrão</label>
              <MoneyInput
                value={Number(dHon) || 0}
                onValueChange={(n) => setDHon(n ? String(n) : "")}
              />
            </div>
            <button className="btn-primary w-full">Adicionar despachante</button>
          </form>

          <ul className="mt-4 space-y-2">
            {despachantes.length === 0 ? (
              <li className="text-sm text-muted">Nenhum despachante cadastrado.</li>
            ) : (
              despachantes.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-ink">{d.nome}</div>
                    <div className="text-xs text-muted">
                      {formatBRL(d.honorarios)}
                      {d.cnpj ? ` · ${d.cnpj}` : ""}
                      {d.contato ? ` · ${d.contato}` : ""}
                    </div>
                  </div>
                  <button className="text-xs text-danger-text hover:underline" onClick={() => removerDespachante(d.id)}>
                    Remover
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Custos recorrentes */}
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold text-ink">Custos recorrentes</h2>
          <form onSubmit={addCusto} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={cTipo} onChange={(e) => setCTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <MoneyInput
                value={Number(cValor) || 0}
                onValueChange={(n) => setCValor(n ? String(n) : "")}
              />
            </div>
            <input className="input" placeholder="Descrição" value={cDesc} onChange={(e) => setCDesc(e.target.value)} required />
            <button className="btn-primary w-full">Adicionar custo</button>
          </form>

          <ul className="mt-4 space-y-2">
            {custos.length === 0 ? (
              <li className="text-sm text-muted">Nenhum custo cadastrado.</li>
            ) : (
              custos.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-ink">{c.descricao}</div>
                    <div className="text-xs text-muted">
                      {c.tipo} · {formatBRL(c.valor)}
                    </div>
                  </div>
                  <button className="text-xs text-danger-text hover:underline" onClick={() => removerCusto(c.id)}>
                    Remover
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Log de auditoria */}
      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold text-ink">Log de auditoria (RF12)</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted">Sem alterações registradas ainda.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2">
                <span className="text-ink">
                  <span className="badge mr-2 bg-page text-ink2">{l.acao}</span>
                  {l.entidade}
                </span>
                <span className="text-xs text-muted">{formatData(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
