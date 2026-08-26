import type { EntradaCalculo, ResultadoCalculo } from "@/lib/tax/types";

export interface ExportPayload {
  resultado: ResultadoCalculo;
  apelido?: string | null;
  createdAt?: string | Date;
  /** Id da importação — impresso para rastreio (RNF-6). */
  importacaoId?: string;
  /**
   * Entrada original. Vai embutida nos metadados do PDF e numa aba do Excel
   * para que o próprio arquivo exportado possa ser reimportado sem perda —
   * é o que permite migrar o histórico entre contas.
   */
  entrada?: EntradaCalculo;
}
