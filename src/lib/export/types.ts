import type { TaxResult } from "@/lib/tax/types";

export interface ExportPayload {
  resultado: TaxResult;
  descricaoProduto?: string | null;
  createdAt?: string | Date;
}
