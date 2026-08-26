# apps/landing

Reservado para a landing page do Aliquo. Ainda não implementado —
propositalmente sem framework escolhido, fica a critério de quem for construir.

## Convenções do monorepo (só isso é obrigatório)

- Workspace do npm (`npm workspaces`, ver `package.json` na raiz): rode
  `npm install` na raiz, nunca dentro de `apps/landing`.
- Scripts que o CI (`.github/workflows/ci.yml`) já espera, quando existirem
  (todos rodam com `--if-present`, então nada quebra até você adicioná-los):
  - `npm run dev --workspace=apps/landing`
  - `npm run build --workspace=apps/landing`
  - `npm run typecheck --workspace=apps/landing` (se usar TypeScript)
  - `npm run test --workspace=apps/landing` (se tiver testes)
- Commits em Conventional Commits, PR sempre para `homolog` (nunca direto pra
  `main`) — ver [CONTRIBUTING.md](../../CONTRIBUTING.md) na raiz.
