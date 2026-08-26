import { BR_2026_ATUAL } from "./br-2026-atual";
import type { RuleSet } from "./tipos";

/**
 * Registro de conjuntos de regras.
 *
 * Adicionar o cálculo dual da reforma (RF-B2) é adicionar um módulo aqui e
 * selecioná-lo por data de referência — sem tocar no motor. É esse desenho
 * que torna "pronto para a reforma" uma mudança de dados, não um fork.
 */
export const RULESETS: Record<string, RuleSet> = {
  [BR_2026_ATUAL.id]: BR_2026_ATUAL,
};

export const RULESET_PADRAO_ID = BR_2026_ATUAL.id;

export function getRuleSet(id?: string | null): RuleSet {
  if (id && RULESETS[id]) return RULESETS[id];
  return RULESETS[RULESET_PADRAO_ID];
}

/** Seleciona o conjunto vigente numa data (ISO). */
export function getRuleSetPorData(dataIso: string): RuleSet {
  const alvo = dataIso.slice(0, 10);
  const candidatos = Object.values(RULESETS).filter(
    (r) => r.vigenciaInicio <= alvo && (!r.vigenciaFim || r.vigenciaFim >= alvo),
  );
  if (candidatos.length === 0) return RULESETS[RULESET_PADRAO_ID];
  // Mais recente primeiro.
  candidatos.sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));
  return candidatos[0];
}

export * from "./tipos";
