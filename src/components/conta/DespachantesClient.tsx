"use client";

import { useEffect, useState } from "react";
import { formatBRL, formatData } from "@/lib/format";
import { MoneyInput } from "@/components/MoneyInput";

/**
 * Cadastros reaproveitáveis: despachantes e custos recorrentes.
 *
 * O que já foi salvo pesa mais que o formulário de cadastro, então a lista
 * fica no topo do painel e o formulário embaixo, atrás de um fio.
 */

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

/** O log guarda o verbo cru; a tela mostra o que a pessoa entende. */
const ACOES: Record<string, string> = {
  criar: "cadastrou",
  atualizar: "alterou",
  remover: "removeu",
};

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
    <div className="space-y-6">
      <header className="border-b border-fio pb-4">
        <p className="secao">Cadastros</p>
        <h1 className="mt-1.5 font-serifa text-[26px] font-semibold leading-tight text-tinta">
          Despachantes e custos recorrentes
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta2">
          O que estiver salvo aqui aparece como opção nas simulações, sem redigitação. Toda
          inclusão e remoção fica registrada abaixo.
        </p>
      </header>

      {erro ? <p className="aviso-carimbo">{erro}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Despachantes */}
        <section className="painel flex flex-col">
          <div className="painel-titulo">
            <h2 className="font-serifa text-[16px] font-semibold text-tinta">Despachantes</h2>
            <span className="font-mono text-[12px] text-fraco">{despachantes.length}</span>
          </div>

          {despachantes.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-fraco">
              Nenhum despachante cadastrado ainda.
            </p>
          ) : (
            <ul className="flex-1">
              {despachantes.map((d) => (
                <li
                  key={d.id}
                  className="group flex items-start justify-between gap-3 border-b border-fio px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-tinta">{d.nome}</p>
                    <p className="mt-0.5 text-[11.5px] text-fraco">
                      <span className="font-mono">{formatBRL(d.honorarios)}</span>
                      {d.cnpj ? ` · ${d.cnpj}` : ""}
                      {d.contato ? ` · ${d.contato}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerDespachante(d.id)}
                    className="shrink-0 text-[11.5px] text-fraco underline-offset-2 transition-colors hover:text-carimbo hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addDespachante} className="space-y-2.5 border-t border-fio2 bg-papel2/40 px-5 py-4">
            <p className="secao">Novo despachante</p>
            <input
              className="input"
              placeholder="Nome"
              value={dNome}
              onChange={(e) => setDNome(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="CNPJ (opcional)"
                value={dCnpj}
                onChange={(e) => setDCnpj(e.target.value)}
              />
              <input
                className="input"
                placeholder="Contato (opcional)"
                value={dContato}
                onChange={(e) => setDContato(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Honorário padrão</label>
                <MoneyInput
                  value={Number(dHon) || 0}
                  onValueChange={(n) => setDHon(n ? String(n) : "")}
                />
              </div>
              <button className="btn-primary">Adicionar</button>
            </div>
          </form>
        </section>

        {/* Custos recorrentes */}
        <section className="painel flex flex-col">
          <div className="painel-titulo">
            <h2 className="font-serifa text-[16px] font-semibold text-tinta">Custos recorrentes</h2>
            <span className="font-mono text-[12px] text-fraco">{custos.length}</span>
          </div>

          {custos.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-fraco">Nenhum custo cadastrado ainda.</p>
          ) : (
            <ul className="flex-1">
              {custos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 border-b border-fio px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-tinta">{c.descricao}</p>
                    <p className="mt-0.5 text-[11.5px] text-fraco">
                      {c.tipo} · <span className="font-mono">{formatBRL(c.valor)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerCusto(c.id)}
                    className="shrink-0 text-[11.5px] text-fraco underline-offset-2 transition-colors hover:text-carimbo hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addCusto} className="space-y-2.5 border-t border-fio2 bg-papel2/40 px-5 py-4">
            <p className="secao">Novo custo</p>
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
            <div className="flex items-end gap-2">
              <input
                className="input flex-1"
                placeholder="Descrição"
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
                required
              />
              <button className="btn-primary">Adicionar</button>
            </div>
          </form>
        </section>
      </div>

      {/* Registro de alterações */}
      <section className="painel">
        <div className="painel-titulo">
          <h2 className="font-serifa text-[16px] font-semibold text-tinta">
            Registro de alterações
          </h2>
          <span className="text-[11.5px] text-fraco">quem mexeu em quê, e quando</span>
        </div>
        {logs.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-fraco">Sem alterações registradas ainda.</p>
        ) : (
          <ul>
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 border-b border-fio px-5 py-2.5 text-[13px] last:border-b-0"
              >
                <span className="text-tinta2">
                  <span className="text-tinta">{ACOES[l.acao] ?? l.acao}</span> {l.entidade}
                </span>
                <span className="shrink-0 font-mono text-[11.5px] text-fraco">
                  {formatData(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
