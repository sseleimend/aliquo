/**
 * O projeto ainda não tem ESLint/Prettier configurados (`next lint` pede
 * setup interativo na primeira execução). Até isso ser decidido à parte, o
 * pre-commit garante só o typecheck do projeto quando algo em TS muda —
 * roda uma vez para o projeto inteiro, não por arquivo, porque o
 * TypeScript precisa do contexto completo.
 */
module.exports = {
  "*.{ts,tsx}": () => "tsc --noEmit",
};
