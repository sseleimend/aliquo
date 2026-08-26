# Aliquo

Monorepo (`npm workspaces`) do Aliquo — simulador de landed cost e a
presença pública do produto.

| Workspace | O que é | README |
|---|---|---|
| [`apps/simulador`](apps/simulador) | O produto: simulador de custo de importação | [apps/simulador/README.md](apps/simulador/README.md) |
| [`apps/landing`](apps/landing) | Landing page (em construção) | [apps/landing/README.md](apps/landing/README.md) |

## Como rodar

```bash
npm install                          # na raiz — instala todos os workspaces
npm run dev                          # sobe apps/simulador (ver o README dele pra setup de banco)
npm run dev:landing                  # sobe apps/landing, quando existir
```

`npm run <script> --workspaces --if-present` roda esse script em todo
workspace que o tiver (`build`, `test`, `typecheck`, `lint`) — é o que o CI
usa.

## Fluxo de branches, commits e CI

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
