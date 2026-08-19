import { describe, expect, it } from "vitest";
import { diaUtilAnterior, paraFormatoBcb, paraIsoData } from "./tipos";

describe("data de referência do câmbio fiscal", () => {
  it("segunda-feira volta para a sexta anterior", () => {
    // 2026-08-17 é uma segunda-feira.
    const segunda = new Date(Date.UTC(2026, 7, 17));
    expect(paraIsoData(diaUtilAnterior(segunda))).toBe("2026-08-14");
  });

  it("domingo volta para a sexta anterior", () => {
    const domingo = new Date(Date.UTC(2026, 7, 16));
    expect(paraIsoData(diaUtilAnterior(domingo))).toBe("2026-08-14");
  });

  it("terça volta para a segunda", () => {
    const terca = new Date(Date.UTC(2026, 7, 18));
    expect(paraIsoData(diaUtilAnterior(terca))).toBe("2026-08-17");
  });

  it("formata a data como a API do Banco Central espera (MM-DD-YYYY)", () => {
    expect(paraFormatoBcb(new Date(Date.UTC(2026, 7, 17)))).toBe("08-17-2026");
  });
});
