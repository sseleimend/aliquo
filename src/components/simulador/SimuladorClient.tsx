"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChatNcm } from "@/components/simulador/ChatNcm";
import { ResultadoBreakdown } from "@/components/simulador/ResultadoBreakdown";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { MoneyInput } from "@/components/MoneyInput";
import { UF_LIST } from "@/lib/tax/rates";
import { normalizeNcm } from "@/lib/ncm/dataset";
import { formatBRL, formatMoeda } from "@/lib/format";
import type { TaxResult } from "@/lib/tax/types";

const STEPS = ["NCM", "Valores & câmbio", "Custos variáveis", "Resultado"];

interface Despachante {
  id: string;
  nome: string;
  honorarios: number;
}
interface Custo {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
}

const emptyForm = {
  fobMoeda: "",
  quantidade: "1",
  moeda: "USD",
  uf: "SP",
  freteInternacional: "",
  seguroInternacional: "",
  thc: "",
  armazenagem: "",
  despachante: "",
  siscomex: "",
  afrmm: "",
  outrosCustos: "",
};

export function SimuladorClient() {
  const [step, setStep] = useState(0);

  // Etapa 0 — NCM
  const [modo, setModo] = useState<"descrever" | "digitar">("descrever");
  const [ncm, setNcm] = useState("");
  const [ncmDescricao, setNcmDescricao] = useState<string | undefined>();
  const [ncmInfo, setNcmInfo] = useState<{ descricao: string | null; aviso: string | null } | null>(
    null,
  );
  const [ncmInput, setNcmInput] = useState("");

  // Etapas 1-2 — formulário
  const [form, setForm] = useState({ ...emptyForm });
  const [cambio, setCambio] = useState<{ rate: number; currency: string; simulado: boolean } | null>(
    null,
  );
  const [moedas, setMoedas] = useState<string[]>(["USD", "EUR", "CNY", "GBP", "JPY"]);

  // Cadastros salvos (RF11)
  const [despachantes, setDespachantes] = useState<Despachante[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);

  // Resultado
  const [resultado, setResultado] = useState<TaxResult | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fetchCambio = useCallback(async (moeda: string) => {
    try {
      const r = await fetch(`/api/fx?currency=${encodeURIComponent(moeda)}`);
      const data = await r.json();
      if (r.ok) {
        setCambio({ rate: data.rate, currency: data.currency, simulado: data.simulado });
        if (Array.isArray(data.moedasSuportadas)) setMoedas(data.moedasSuportadas);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    if (step === 1) fetchCambio(form.moeda);
  }, [step, form.moeda, fetchCambio]);

  useEffect(() => {
    if (step !== 2) return;
    fetch("/api/despachantes")
      .then((r) => r.json())
      .then((d) => setDespachantes(d.despachantes ?? []))
      .catch(() => {});
    fetch("/api/custos")
      .then((r) => r.json())
      .then((d) => setCustos(d.custos ?? []))
      .catch(() => {});
  }, [step]);

  function confirmarNcm(codigo: string, descricao?: string) {
    setNcm(normalizeNcm(codigo));
    setNcmDescricao(descricao);
    setStep(1);
  }

  async function verificarNcm() {
    const code = normalizeNcm(ncmInput);
    if (code.replace(/\D/g, "").length !== 8) {
      setNcmInfo({ descricao: null, aviso: "Informe um NCM com 8 dígitos." });
      return;
    }
    const r = await fetch(`/api/ncm/search?ncm=${encodeURIComponent(code)}`);
    const data = await r.json();
    setNcmInfo({ descricao: data.descricao ?? null, aviso: data.aviso ?? null });
  }

  const quantidade = Number(form.quantidade) || 0;
  const fobTotalMoeda = (Number(form.fobMoeda) || 0) * (quantidade || 1);
  const fobBrl = fobTotalMoeda * (cambio?.rate ?? 0);
  const vaPreview = fobBrl + (Number(form.freteInternacional) || 0) + (Number(form.seguroInternacional) || 0);

  async function calcular() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/simulacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncm,
          descricaoProduto: ncmDescricao,
          valorUnitarioMoeda: Number(form.fobMoeda) || 0,
          quantidade: Number(form.quantidade) || 1,
          moeda: form.moeda,
          uf: form.uf,
          freteInternacional: Number(form.freteInternacional) || 0,
          seguroInternacional: Number(form.seguroInternacional) || 0,
          thc: Number(form.thc) || 0,
          armazenagem: Number(form.armazenagem) || 0,
          despachante: Number(form.despachante) || 0,
          siscomex: Number(form.siscomex) || 0,
          afrmm: Number(form.afrmm) || 0,
          outrosCustos: Number(form.outrosCustos) || 0,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.error ?? "Falha no cálculo.");
        return;
      }
      setResultado(data.resultado);
      setSimId(data.id);
      setStep(3);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function novaSimulacao() {
    setStep(0);
    setModo("descrever");
    setNcm("");
    setNcmDescricao(undefined);
    setNcmInfo(null);
    setNcmInput("");
    setForm({ ...emptyForm });
    setResultado(null);
    setSimId(null);
    setErro(null);
  }

  const podeIrValores = Number(form.fobMoeda) > 0 && quantidade > 0 && form.uf && cambio;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nova simulação</h1>
        <p className="text-sm text-ink2">
          Do NCM ao custo total de nacionalização, com verificação humana obrigatória.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              i === step
                ? "bg-accent text-white"
                : i < step
                  ? "bg-teal-bg text-teal-text"
                  : "bg-page text-muted"
            }`}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/25 text-[11px]">
              {i < step ? "✓" : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {erro ? (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger-text">{erro}</p>
      ) : null}

      {/* ── Etapa 0: NCM ─────────────────────────────────────────── */}
      {step === 0 ? (
        <div className="card p-5">
          <div className="mb-4 inline-flex rounded-lg border border-line p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${
                modo === "descrever" ? "bg-accent text-white" : "text-ink2"
              }`}
              onClick={() => setModo("descrever")}
            >
              Descrever produto (IA)
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${
                modo === "digitar" ? "bg-accent text-white" : "text-ink2"
              }`}
              onClick={() => setModo("digitar")}
            >
              Já sei o NCM
            </button>
          </div>

          {modo === "descrever" ? (
            <ChatNcm onConfirmar={confirmarNcm} />
          ) : (
            <div className="space-y-3">
              <label className="label" htmlFor="ncm-direto">
                Código NCM (RF01)
              </label>
              <div className="flex gap-2">
                <input
                  id="ncm-direto"
                  className="input font-mono"
                  placeholder="0000.00.00"
                  value={ncmInput}
                  onChange={(e) => setNcmInput(normalizeNcm(e.target.value))}
                />
                <button className="btn-secondary" onClick={verificarNcm}>
                  Verificar
                </button>
              </div>
              {ncmInfo ? (
                <div className="rounded-lg border border-line bg-page p-3 text-sm">
                  {ncmInfo.descricao ? (
                    <p className="text-ink">{ncmInfo.descricao}</p>
                  ) : (
                    <p className="text-muted">Sem descrição na base de amostra.</p>
                  )}
                  {ncmInfo.aviso ? <p className="mt-1 text-xs text-warn-text">{ncmInfo.aviso}</p> : null}
                </div>
              ) : null}
              <button
                className="btn-primary"
                onClick={() => confirmarNcm(ncmInput)}
                disabled={normalizeNcm(ncmInput).replace(/\D/g, "").length !== 8}
              >
                Confirmar NCM e continuar
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Etapa 1: Valores & câmbio ────────────────────────────── */}
      {step === 1 ? (
        <div className="card space-y-4 p-5">
          <NcmChip ncm={ncm} descricao={ncmDescricao} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valor unitário (FOB)</label>
              <MoneyInput
                prefix={form.moeda}
                value={Number(form.fobMoeda) || 0}
                onValueChange={(n) => set("fobMoeda", n ? String(n) : "")}
              />
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                className="input"
                value={form.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Moeda</label>
              <select className="input" value={form.moeda} onChange={(e) => set("moeda", e.target.value)}>
                {moedas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">UF de destino (RF07)</label>
              <select className="input" value={form.uf} onChange={(e) => set("uf", e.target.value)}>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Frete internacional (R$) — compõe o VA</label>
              <MoneyInput
                value={Number(form.freteInternacional) || 0}
                onValueChange={(n) => set("freteInternacional", n ? String(n) : "")}
              />
            </div>
            <div>
              <label className="label">Seguro internacional (R$) — compõe o VA</label>
              <MoneyInput
                value={Number(form.seguroInternacional) || 0}
                onValueChange={(n) => set("seguroInternacional", n ? String(n) : "")}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-page p-3 text-sm">
            <span className="text-ink2">
              Câmbio {cambio?.currency ?? form.moeda}:{" "}
              <strong>{cambio ? formatBRL(cambio.rate) : "…"}</strong>
              {cambio ? (
                <em className={`ml-1 text-xs ${cambio.simulado ? "text-muted" : "text-teal-text"}`}>
                  {cambio.simulado ? "(simulado)" : "(tempo real)"}
                </em>
              ) : null}
            </span>
            {quantidade > 1 ? (
              <span className="text-ink2">
                FOB total: <strong>{formatMoeda(fobTotalMoeda, form.moeda)}</strong>
                <em className="ml-1 text-xs text-muted">({quantidade} un)</em>
              </span>
            ) : null}
            <span className="text-ink2">
              Valor aduaneiro estimado: <strong>{formatBRL(vaPreview)}</strong>
            </span>
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(0)}>
              Voltar
            </button>
            <button className="btn-primary" onClick={() => setStep(2)} disabled={!podeIrValores}>
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Etapa 2: Custos variáveis ────────────────────────────── */}
      {step === 2 ? (
        <div className="card space-y-4 p-5">
          <NcmChip ncm={ncm} descricao={ncmDescricao} />
          <p className="text-sm text-ink2">
            Custos informados manualmente (RF09). Siscomex e AFRMM entram também na base do ICMS.
          </p>

          {/* Quick-fill de cadastros salvos */}
          {despachantes.length > 0 || custos.length > 0 ? (
            <div className="rounded-lg border border-line bg-page p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                Reaproveitar cadastros salvos
              </p>
              <div className="flex flex-wrap gap-2">
                {despachantes.map((d) => (
                  <button
                    key={d.id}
                    className="badge bg-accent-bg text-accent-text hover:opacity-80"
                    onClick={() => set("despachante", String(d.honorarios))}
                  >
                    {d.nome} · {formatBRL(d.honorarios)}
                  </button>
                ))}
                {custos.map((c) => (
                  <button
                    key={c.id}
                    className="badge bg-teal-bg text-teal-text hover:opacity-80"
                    onClick={() =>
                      set(
                        (["frete", "thc", "armazenagem", "siscomex", "afrmm"].includes(c.tipo)
                          ? c.tipo === "frete"
                            ? "freteInternacional"
                            : (c.tipo as keyof typeof emptyForm)
                          : "outrosCustos") as keyof typeof emptyForm,
                        String(c.valor),
                      )
                    }
                  >
                    {c.descricao} · {formatBRL(c.valor)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoCusto label="Taxa Siscomex (R$)" value={form.siscomex} onChange={(v) => set("siscomex", v)} />
            <CampoCusto label="AFRMM (R$) — frete marítimo SP/RJ" value={form.afrmm} onChange={(v) => set("afrmm", v)} />
            <div>
              <div className="flex items-center justify-between">
                <label className="label">THC (R$)</label>
                <button
                  type="button"
                  className="text-xs text-accent-text hover:underline"
                  onClick={() => set("thc", (Math.round(fobBrl * 0.01 * 100) / 100).toString())}
                >
                  Sugerir ~1%
                </button>
              </div>
              <MoneyInput
                value={Number(form.thc) || 0}
                onValueChange={(n) => set("thc", n ? String(n) : "")}
              />
            </div>
            <CampoCusto label="Armazenagem (R$)" value={form.armazenagem} onChange={(v) => set("armazenagem", v)} />
            <CampoCusto
              label="Honorários de despachante (R$)"
              value={form.despachante}
              onChange={(v) => set("despachante", v)}
            />
            <CampoCusto label="Outros custos (R$)" value={form.outrosCustos} onChange={(v) => set("outrosCustos", v)} />
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button className="btn-primary" onClick={calcular} disabled={carregando}>
              {carregando ? "Calculando…" : "Calcular landed cost"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Etapa 3: Resultado ───────────────────────────────────── */}
      {step === 3 && resultado ? (
        <div className="space-y-5">
          <ResultadoBreakdown resultado={resultado} simId={simId} />
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={novaSimulacao}>
              Nova simulação
            </button>
            <Link className="btn-secondary" href="/historico">
              Ver histórico
            </Link>
          </div>
        </div>
      ) : null}

      {step < 3 ? <DisclaimerBanner /> : null}
    </div>
  );
}

function NcmChip({ ncm, descricao }: { ncm: string; descricao?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent-bg px-3 py-2 text-sm text-accent-text">
      <span className="badge bg-white/60">NCM confirmado</span>
      <span className="font-mono font-semibold">{ncm}</span>
      {descricao ? <span className="truncate text-xs opacity-80">· {descricao}</span> : null}
    </div>
  );
}

function CampoCusto({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <MoneyInput
        value={Number(value) || 0}
        onValueChange={(n) => onChange(n ? String(n) : "")}
      />
    </div>
  );
}
