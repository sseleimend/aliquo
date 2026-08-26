// Tipos de custo recorrente aceitos (RF11).
export const TIPOS_CUSTO = [
  "frete",
  "thc",
  "armazenagem",
  "siscomex",
  "afrmm",
  "outro",
] as const;

export type TipoCusto = (typeof TIPOS_CUSTO)[number];
