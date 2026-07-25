// Tipos puros do chat de NCM — compartilhados entre servidor e cliente
// (sem dependências de runtime, seguro para importar em client components).

export interface Candidato {
  ncm: string;
  descricao: string;
  categoria: string;
  score: number;
  confianca: number;
  /** Origem do candidato: "base" = dataset de amostra; "ia" = sugerido pelo LLM. */
  fonte?: "base" | "ia";
}

export interface NcmChatRequest {
  descricao: string;
  respostas?: string[];
}

export interface NcmChatResponse {
  reformulacao: string;
  perguntasFeitas: number;
  proximaPergunta: string | null;
  atingiuTeto: boolean;
  confianca: number;
  candidatos: Candidato[] | null;
  disclaimer: string;
  aviso?: string;
}
