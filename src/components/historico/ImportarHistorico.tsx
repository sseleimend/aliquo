"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Migração de histórico (onboarding).
 *
 * O caminho confiável é a PLANILHA: quem vem de outra ferramenta baixa o
 * modelo, preenche e envia. O PDF só é aceito quando foi gerado pelo próprio
 * Aliquo — nesse caso ele carrega os dados nos metadados e o retorno é exato.
 *
 * PDF de terceiros é recusado de propósito: adivinhar números a partir de um
 * layout arbitrário produziria custo fiscal inventado, que é exatamente o que
 * este produto existe para não fazer.
 */

interface Resposta {
  criadas?: number;
  falhas?: Array<{ referencia: string; motivo: string }>;
  erros?: Array<{ linha: number; campo: string; mensagem: string }>;
  error?: string;
  baixarTemplate?: boolean;
  upgrade?: boolean;
}

export function ImportarHistorico() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setResposta(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const res = await fetch("/api/importacoes/importar", { method: "POST", body: fd });
      const data = (await res.json()) as Resposta;
      setResposta(data);
      if (res.ok && data.criadas) router.refresh();
    } catch {
      setResposta({ error: "Não foi possível enviar o arquivo." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="painel px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold text-tinta">Trazer histórico de outra ferramenta</p>
          <p className="text-[12.5px] text-tinta2">
            Baixe o modelo, preencha com suas importações e envie — ou reenvie um PDF/Excel
            gerado aqui.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a className="btn-secondary" href="/api/importacoes/template">
            Baixar modelo (Excel)
          </a>
          <button type="button" className="btn-primary" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Fechar" : "Anexar arquivo"}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="mt-4 space-y-3 border-t border-fio pt-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            className="input"
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviar(f);
            }}
          />
          <p className="text-[12.5px] text-tinta2">
            Planilha no formato do modelo (.xlsx) ou PDF/Excel exportado pelo Aliquo. Até 10 MB.
            Os tributos são recalculados com as alíquotas oficiais de hoje.
          </p>

          {enviando && <p className="text-[13px] text-fraco">Processando…</p>}

          {resposta?.error && (
            <div className="aviso-carimbo">
              <p>{resposta.error}</p>
              {resposta.baixarTemplate && (
                <a className="mt-1 inline-block underline" href="/api/importacoes/template">
                  Baixar o modelo de planilha
                </a>
              )}
            </div>
          )}

          {resposta?.erros && resposta.erros.length > 0 && (
            <div className="aviso-nota text-[12px]">
              <p className="font-semibold">Linhas ignoradas:</p>
              <ul className="mt-1 space-y-0.5">
                {resposta.erros.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    linha {e.linha} · {e.mensagem}
                  </li>
                ))}
                {resposta.erros.length > 10 && <li>…e mais {resposta.erros.length - 10}.</li>}
              </ul>
            </div>
          )}

          {typeof resposta?.criadas === "number" && resposta.criadas > 0 && (
            <div className="aviso-visto">
              {resposta.criadas} importação(ões) trazida(s) para o histórico.
            </div>
          )}

          {resposta?.falhas && resposta.falhas.length > 0 && (
            <div className="aviso-carimbo text-[12px]">
              <p className="font-semibold">Não foi possível importar:</p>
              <ul className="mt-1 space-y-0.5">
                {resposta.falhas.map((f, i) => (
                  <li key={i}>
                    <strong>{f.referencia}</strong>: {f.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
