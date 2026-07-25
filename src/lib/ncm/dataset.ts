// ─────────────────────────────────────────────────────────────────────────
// Base de amostra de NCM — PROTÓTIPO.
//
// ATENÇÃO: descrições, palavras-chave e alíquotas abaixo são APROXIMAÇÕES de
// amostra para o protótipo. NÃO refletem a TEC/TIPI oficiais. A fonte oficial
// (Receita Federal) é uma dependência técnica em aberto (seção 11 do PRD).
//
// Este mesmo dataset serve a dois propósitos:
//   1. Busca de NCM a partir de descrição (lib/ncm/classifier.ts)
//   2. Fonte das alíquotas federais por NCM (lib/tax/rates.ts)
// ─────────────────────────────────────────────────────────────────────────

export interface NcmEntry {
  /** Código NCM formatado (8 dígitos, com pontos). */
  ncm: string;
  /** Descrição técnica de referência. */
  descricao: string;
  /** Capítulo/categoria (texto livre, para exibição). */
  categoria: string;
  /** Termos de busca (pt/en, sinônimos) para o keyword scoring. */
  keywords: string[];
  /** Alíquotas federais de amostra (fração, ex.: 0.16 = 16%). */
  aliquotas: {
    ii: number;
    ipi: number;
    pis: number;
    cofins: number;
  };
}

// PIS/COFINS-Importação (Lei 10.865) — valores gerais usados como amostra.
const PIS = 0.021;
const COFINS = 0.0965;

export const NCM_DATASET: NcmEntry[] = [
  {
    ncm: "8544.42.00",
    descricao:
      "Cabos e outros condutores elétricos, para tensão <= 1000V, munidos de peças de conexão (ex.: cabo USB, HDMI)",
    categoria: "85 — Máquinas e material elétrico",
    keywords: [
      "cabo",
      "cabos",
      "usb",
      "usb-c",
      "type-c",
      "hdmi",
      "conector",
      "condutor",
      "fio",
      "carregador",
      "cable",
      "wire",
      "charger",
    ],
    aliquotas: { ii: 0.144, ipi: 0.1, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8517.13.00",
    descricao: "Telefones inteligentes (smartphones)",
    categoria: "85 — Máquinas e material elétrico",
    keywords: [
      "smartphone",
      "celular",
      "telefone",
      "telefone celular",
      "iphone",
      "android",
      "phone",
      "mobile",
    ],
    aliquotas: { ii: 0.16, ipi: 0.15, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8471.30.19",
    descricao:
      "Máquinas automáticas para processamento de dados, portáteis, peso <= 10 kg (notebooks/laptops)",
    categoria: "84 — Máquinas e aparelhos mecânicos",
    keywords: [
      "notebook",
      "laptop",
      "computador portatil",
      "ultrabook",
      "macbook",
      "computer",
      "pc portatil",
    ],
    aliquotas: { ii: 0.16, ipi: 0.15, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8523.51.10",
    descricao: "Dispositivos de armazenamento não volátil (memória flash, SSD, pendrive)",
    categoria: "85 — Máquinas e material elétrico",
    keywords: [
      "ssd",
      "pendrive",
      "pen drive",
      "cartao de memoria",
      "memoria flash",
      "flash",
      "memory card",
      "usb stick",
      "armazenamento",
    ],
    aliquotas: { ii: 0.16, ipi: 0.05, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8518.30.00",
    descricao: "Fones de ouvido e auscultadores, mesmo combinados com microfone",
    categoria: "85 — Máquinas e material elétrico",
    keywords: [
      "fone",
      "fone de ouvido",
      "headphone",
      "headset",
      "earbuds",
      "earphone",
      "auscultador",
      "bluetooth",
    ],
    aliquotas: { ii: 0.16, ipi: 0.1, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "6109.10.00",
    descricao: "Camisetas (T-shirts) e camisetas interiores, de malha, de algodão",
    categoria: "61 — Vestuário de malha",
    keywords: [
      "camiseta",
      "camisetas",
      "t-shirt",
      "tshirt",
      "blusa",
      "malha",
      "algodao",
      "vestuario",
      "roupa",
      "cotton",
      "shirt",
    ],
    aliquotas: { ii: 0.35, ipi: 0.0, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "6403.99.00",
    descricao: "Calçados com sola de borracha/plástico e parte superior de couro natural",
    categoria: "64 — Calçados",
    keywords: [
      "calcado",
      "sapato",
      "tenis",
      "bota",
      "couro",
      "shoe",
      "sneaker",
      "boot",
      "footwear",
    ],
    aliquotas: { ii: 0.35, ipi: 0.0, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "4202.92.00",
    descricao: "Bolsas, mochilas e estojos com superfície exterior de matérias têxteis ou plástico",
    categoria: "42 — Obras de couro; artigos de viagem",
    keywords: [
      "bolsa",
      "mochila",
      "mala",
      "estojo",
      "necessaire",
      "bag",
      "backpack",
      "suitcase",
      "pouch",
    ],
    aliquotas: { ii: 0.2, ipi: 0.0, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "9503.00.99",
    descricao: "Brinquedos, outros (não motorizados), n.e.",
    categoria: "95 — Brinquedos, jogos e artigos para desporto",
    keywords: [
      "brinquedo",
      "brinquedos",
      "boneca",
      "carrinho",
      "toy",
      "toys",
      "jogo infantil",
      "pelucia",
    ],
    aliquotas: { ii: 0.2, ipi: 0.0, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "3304.99.90",
    descricao:
      "Preparações de beleza, maquiagem e cuidados da pele (exceto medicamentos), outras",
    categoria: "33 — Óleos essenciais; cosméticos",
    keywords: [
      "cosmetico",
      "creme",
      "hidratante",
      "maquiagem",
      "skincare",
      "serum",
      "beleza",
      "cosmetic",
      "makeup",
      "lotion",
    ],
    aliquotas: { ii: 0.18, ipi: 0.22, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "9018.90.99",
    descricao: "Instrumentos e aparelhos para medicina, cirurgia ou veterinária, outros",
    categoria: "90 — Instrumentos de óptica, medida, medicina",
    keywords: [
      "medico",
      "hospitalar",
      "cirurgico",
      "instrumento medico",
      "aparelho medico",
      "medical",
      "surgical",
      "diagnostico",
    ],
    aliquotas: { ii: 0.14, ipi: 0.0, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8536.90.90",
    descricao:
      "Aparelhos para interrupção, seccionamento ou conexão de circuitos elétricos, <= 1000V, outros",
    categoria: "85 — Máquinas e material elétrico",
    keywords: [
      "conector eletrico",
      "terminal",
      "rele",
      "interruptor",
      "disjuntor",
      "borne",
      "switch",
      "relay",
      "connector",
    ],
    aliquotas: { ii: 0.144, ipi: 0.1, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8481.80.99",
    descricao: "Válvulas, torneiras e dispositivos semelhantes para canalizações, outros",
    categoria: "84 — Máquinas e aparelhos mecânicos",
    keywords: [
      "valvula",
      "torneira",
      "registro",
      "valve",
      "faucet",
      "canalizacao",
      "hidraulica",
    ],
    aliquotas: { ii: 0.144, ipi: 0.065, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "9403.60.00",
    descricao: "Móveis de madeira, outros (uso doméstico)",
    categoria: "94 — Móveis; mobiliário",
    keywords: [
      "movel",
      "moveis",
      "madeira",
      "mesa",
      "cadeira",
      "estante",
      "furniture",
      "wood",
      "table",
      "chair",
    ],
    aliquotas: { ii: 0.18, ipi: 0.05, pis: PIS, cofins: COFINS },
  },
  {
    ncm: "8708.99.90",
    descricao: "Partes e acessórios de veículos automóveis, outros",
    categoria: "87 — Veículos e suas partes",
    keywords: [
      "autopeca",
      "peca automotiva",
      "acessorio automotivo",
      "carro",
      "veiculo",
      "auto part",
      "car part",
      "spare part",
    ],
    aliquotas: { ii: 0.18, ipi: 0.1, pis: PIS, cofins: COFINS },
  },
];

/** Formata NCM removendo tudo que não é dígito e reaplica a máscara 0000.00.00. */
export function normalizeNcm(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

/** Retorna a entrada exata pelo código (comparando apenas dígitos). */
export function findByNcm(code: string): NcmEntry | undefined {
  const digits = (code || "").replace(/\D/g, "");
  return NCM_DATASET.find((e) => e.ncm.replace(/\D/g, "") === digits);
}
