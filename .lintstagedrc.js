/**
 * Monorepo (npm workspaces): roda o typecheck do workspace inteiro sempre
 * que algo em TS muda, em vez de tentar mapear arquivo -> workspace aqui.
 * O projeto ainda não tem ESLint/Prettier configurados (`next lint` pede
 * setup interativo na primeira execução).
 */
module.exports = {
  "*.{ts,tsx}": () => "npm run typecheck --workspaces --if-present",
};
