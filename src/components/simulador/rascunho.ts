/**
 * Estado do simulador como um DOCUMENTO com transições explícitas.
 *
 * O componente antigo tinha 16 `useState` soltos e já não cabia em 4 passos.
 * Com 6 passos, múltiplos itens e dois ritmos, o que importa é poder
 * responder a perguntas como "dá para chegar no passo 5 sem NCM confirmada?"
 * — e isso é uma questão de correção, não de layout. Como reducer puro, ela
 * é testável sem renderizar nada.
 *
 * O rascunho mapeia 1:1 para o corpo do POST /api/importacoes.
 */

import type { RegimeTributario, ResultadoCalculo } from "@/lib/tax/types";

export type ModoUso = "guiado" | "rapido";
export type FonteNcm = "ia_confirmada" | "manual" | "reuso" | "invoice";

export interface ItemRascunho {
  id: string;
  ncm: string; // só dígitos
  ncmFmt: string;
  ncmDescricaoOficial?: string;
  ncmCaminhoOficial?: string;
  ncmFonte: FonteNcm;
  ncmConfianca?: number;
  confirmado: boolean;
  descricaoProduto: string;
  quantidade: string;
  valorUnitarioMoeda: string;
  pesoLiquidoKg: string;
  aliquotaIIManual: string;
  aliquotaIPIManual: string;
}

export interface Rascunho {
  passo: number; // 0..5
  modo: ModoUso;
  apelido: string;
  uf: string;
  moeda: string;
  incoterm: string;
  regimeTributario: RegimeTributario;

  itens: ItemRascunho[];
  /** Item que está sendo classificado nos passos 1 e 2. */
  itemAtivo: number;
  /** Fatura comercial vinculada (RF-D2) — opcional. */
  invoiceId: string | null;

  freteInternacional: string;
  seguroInternacional: string;
  seguroDispensado: boolean;
  siscomex: string;
  afrmm: string;
  thc: string;
  armazenagem: string;
  despachante: string;
  outrosCustos: string;
  criterioRateio: "valor" | "peso" | "quantidade";

  resultado: ResultadoCalculo | null;
  importacaoId: string | null;
  duplicadaDeId: string | null;
  erro: string | null;
  carregando: boolean;
}

export const PASSOS = [
  "Descrever produto",
  "Confirmar NCM",
  "Valores e quantidades",
  "Frete e seguro",
  "Custos e tributos",
  "Revisar e salvar",
] as const;

let seq = 0;
export function novoItem(parcial: Partial<ItemRascunho> = {}): ItemRascunho {
  seq += 1;
  return {
    id: `item-${seq}-${Math.random().toString(36).slice(2, 7)}`,
    ncm: "",
    ncmFmt: "",
    ncmFonte: "manual",
    confirmado: false,
    descricaoProduto: "",
    quantidade: "1",
    valorUnitarioMoeda: "",
    pesoLiquidoKg: "",
    aliquotaIIManual: "",
    aliquotaIPIManual: "",
    ...parcial,
  };
}

export function rascunhoInicial(modo: ModoUso = "guiado"): Rascunho {
  return {
    passo: 0,
    modo,
    apelido: "",
    uf: "SP",
    moeda: "USD",
    incoterm: "FOB",
    regimeTributario: "lucro_real",
    itens: [novoItem()],
    itemAtivo: 0,
    invoiceId: null,
    freteInternacional: "",
    seguroInternacional: "",
    // RF-C2 — seguro é recomendado por padrão; o usuário precisa dispensar
    // explicitamente, em vez de simplesmente esquecer.
    seguroDispensado: false,
    siscomex: "",
    afrmm: "",
    thc: "",
    armazenagem: "",
    despachante: "",
    outrosCustos: "",
    criterioRateio: "valor",
    resultado: null,
    importacaoId: null,
    duplicadaDeId: null,
    erro: null,
    carregando: false,
  };
}

export type AcaoRascunho =
  | { tipo: "campo"; campo: keyof Rascunho; valor: unknown }
  | { tipo: "modo"; modo: ModoUso }
  | { tipo: "passo"; passo: number }
  | { tipo: "avancar" }
  | { tipo: "voltar" }
  | { tipo: "item.add" }
  | { tipo: "item.remove"; indice: number }
  | { tipo: "item.ativo"; indice: number }
  | { tipo: "item.campo"; indice: number; campo: keyof ItemRascunho; valor: unknown }
  | {
      tipo: "item.confirmarNcm";
      indice: number;
      ncm: string;
      ncmFmt: string;
      descricaoOficial?: string;
      caminhoOficial?: string;
      fonte: FonteNcm;
      confianca?: number;
    }
  | { tipo: "resultado"; resultado: ResultadoCalculo; importacaoId: string }
  | { tipo: "erro"; erro: string | null }
  | { tipo: "carregando"; carregando: boolean }
  | { tipo: "carregar"; rascunho: Partial<Rascunho>; duplicadaDeId?: string }
  /** Restauração do rascunho salvo em localStorage — nunca sobrepõe um reuso. */
  | { tipo: "restaurar"; rascunho: Partial<Rascunho> }
  | { tipo: "reset" };

export function reducer(estado: Rascunho, acao: AcaoRascunho): Rascunho {
  switch (acao.tipo) {
    case "campo":
      return { ...estado, [acao.campo]: acao.valor, erro: null } as Rascunho;

    case "modo":
      return { ...estado, modo: acao.modo };

    case "passo":
      return { ...estado, passo: Math.max(0, Math.min(PASSOS.length - 1, acao.passo)), erro: null };

    case "avancar": {
      const proximo = Math.min(PASSOS.length - 1, estado.passo + 1);
      return { ...estado, passo: proximo, erro: null };
    }

    case "voltar":
      return { ...estado, passo: Math.max(0, estado.passo - 1), erro: null };

    case "item.add": {
      const itens = [...estado.itens, novoItem()];
      return { ...estado, itens, itemAtivo: itens.length - 1, passo: 0, erro: null };
    }

    case "item.remove": {
      if (estado.itens.length <= 1) return estado;
      const itens = estado.itens.filter((_, i) => i !== acao.indice);
      return {
        ...estado,
        itens,
        itemAtivo: Math.min(estado.itemAtivo, itens.length - 1),
        resultado: null,
      };
    }

    case "item.ativo":
      return { ...estado, itemAtivo: Math.max(0, Math.min(estado.itens.length - 1, acao.indice)) };

    case "item.campo": {
      const itens = estado.itens.map((it, i) =>
        i === acao.indice ? { ...it, [acao.campo]: acao.valor } : it,
      );
      return { ...estado, itens, erro: null };
    }

    case "item.confirmarNcm": {
      const itens = estado.itens.map((it, i) =>
        i === acao.indice
          ? {
              ...it,
              ncm: acao.ncm,
              ncmFmt: acao.ncmFmt,
              ncmDescricaoOficial: acao.descricaoOficial,
              ncmCaminhoOficial: acao.caminhoOficial,
              ncmFonte: acao.fonte,
              ncmConfianca: acao.confianca,
              confirmado: true,
            }
          : it,
      );
      return { ...estado, itens, erro: null };
    }

    case "resultado":
      // A simulação terminou e virou registro no histórico: os campos de
      // entrada são zerados para a próxima. O resultado continua na tela —
      // é dele que o usuário exporta o PDF e navega para o histórico.
      return {
        ...rascunhoInicial(estado.modo),
        resultado: acao.resultado,
        importacaoId: acao.importacaoId,
        passo: PASSOS.length - 1,
        carregando: false,
        erro: null,
      };

    case "erro":
      return { ...estado, erro: acao.erro, carregando: false };

    case "carregando":
      return { ...estado, carregando: acao.carregando };

    case "carregar":
      return {
        ...rascunhoInicial(estado.modo),
        ...acao.rascunho,
        duplicadaDeId: acao.duplicadaDeId ?? null,
      };

    /**
     * A restauração do localStorage roda no mount e disputa com o carregamento
     * de um reuso, que é assíncrono. Sem ordem garantida, a restauração chegava
     * depois e apagava frete, seguro e custos que o reuso tinha trazido.
     *
     * Regra: só restaura sobre um rascunho AINDA INTOCADO. Um reuso já
     * carregado, ou qualquer NCM já confirmada, vence o que estava salvo.
     */
    case "restaurar": {
      const intocado =
        !estado.duplicadaDeId && estado.itens.every((i) => !i.confirmado && !i.ncm);
      if (!intocado) return estado;

      const restaurado = { ...rascunhoInicial(estado.modo), ...acao.rascunho, duplicadaDeId: null };

      // O resultado não é persistido (seria mostrar um número calculado com
      // câmbio de outro momento). Se o rascunho salvo parou na tela de
      // revisão, cair nela vazia é um beco — recua para os custos, de onde o
      // usuário recalcula com um clique.
      if (restaurado.passo >= PASSOS.length - 1 && !restaurado.resultado) {
        restaurado.passo = PASSOS.length - 2;
      }
      return restaurado;
    }

    case "reset":
      return rascunhoInicial(estado.modo);

    default:
      return estado;
  }
}

// ---------------------------------------------------------------------------
// Seletores — as regras de "pode avançar" ficam aqui, testáveis
// ---------------------------------------------------------------------------

export const numero = (s: string): number => {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function itemAtivo(e: Rascunho): ItemRascunho {
  return e.itens[e.itemAtivo] ?? e.itens[0];
}

export function todosConfirmados(e: Rascunho): boolean {
  return e.itens.length > 0 && e.itens.every((i) => i.confirmado && i.ncm.length === 8);
}

export function itensComValor(e: Rascunho): boolean {
  return e.itens.every((i) => numero(i.valorUnitarioMoeda) > 0 && numero(i.quantidade) > 0);
}

/**
 * Impede avançar sem o essencial. A regra crítica: nenhum passo além da
 * confirmação da NCM é alcançável sem NCM confirmada — é a tradução do
 * "IA é só sugestão" em código.
 */
export function podeAvancar(e: Rascunho): boolean {
  switch (e.passo) {
    case 0:
      return itemAtivo(e).descricaoProduto.trim().length >= 2 || itemAtivo(e).confirmado;
    case 1:
      return todosConfirmados(e);
    case 2:
      return todosConfirmados(e) && itensComValor(e) && e.uf.length === 2;
    case 3:
      return todosConfirmados(e) && itensComValor(e);
    case 4:
      return todosConfirmados(e) && itensComValor(e);
    default:
      return false;
  }
}

/** Passos que o usuário já pode acessar clicando no stepper. */
export function passoAcessivel(e: Rascunho, alvo: number): boolean {
  if (alvo <= e.passo) return true;
  if (alvo <= 1) return true;
  return todosConfirmados(e);
}

export function fobTotalMoeda(e: Rascunho): number {
  return e.itens.reduce((s, i) => s + numero(i.valorUnitarioMoeda) * (numero(i.quantidade) || 1), 0);
}

/** Corpo do POST — o rascunho e a API falam a mesma língua. */
export function paraPayload(e: Rascunho) {
  return {
    apelido: e.apelido || undefined,
    invoiceId: e.invoiceId ?? undefined,
    uf: e.uf,
    moeda: e.moeda,
    incoterm: e.incoterm,
    regimeTributario: e.regimeTributario,
    criterioRateio: e.criterioRateio,
    itens: e.itens.map((i) => ({
      ncm: i.ncm,
      descricaoProduto: i.descricaoProduto || undefined,
      quantidade: numero(i.quantidade) || 1,
      valorUnitarioMoeda: numero(i.valorUnitarioMoeda),
      pesoLiquidoKg: numero(i.pesoLiquidoKg) || undefined,
      ncmFonte: i.ncmFonte,
      ncmConfianca: i.ncmConfianca,
      aliquotaIIManual: i.aliquotaIIManual ? numero(i.aliquotaIIManual) / 100 : undefined,
      aliquotaIPIManual: i.aliquotaIPIManual ? numero(i.aliquotaIPIManual) / 100 : undefined,
    })),
    freteInternacional: numero(e.freteInternacional),
    seguroInternacional: numero(e.seguroInternacional),
    siscomex: numero(e.siscomex),
    afrmm: numero(e.afrmm),
    thc: numero(e.thc),
    armazenagem: numero(e.armazenagem),
    despachante: numero(e.despachante),
    outrosCustos: numero(e.outrosCustos),
  };
}
