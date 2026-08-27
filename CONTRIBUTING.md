# Contribuindo

## Monorepo

`npm workspaces` em `apps/*` — ver [README.md](README.md) pra lista dos
workspaces. `npm install` sempre na raiz. Scripts de CI/hooks rodam com
`--workspaces --if-present`, então cada workspace só precisa declarar os
scripts que fizerem sentido pra ele (`build`, `test`, `typecheck`, `lint`).

## Fluxo de branches

```
feature/* , fix/* , chore/* ...
        │
        ▼
     homolog   (QA — recebe qualquer branch, exceto main)
        │
        ▼
       main    (produção — só recebe merge vindo de homolog)
```

- **`main`** é protegida: só aceita PR com origem em `homolog`, exige os
  checks de CI (`typecheck`, `fluxo-branches`, `commitlint`, `build`) verdes,
  e exige aprovação do dono do repositório (único CODEOWNER) antes de
  mesclar — outros colaboradores com acesso de escrita não conseguem
  aprovar essa PR. Ressalva técnica: GitHub não deixa autor aprovar a
  própria PR, então o dono tem bypass da exigência de review só quando ele
  mesmo está mesclando (os outros checks continuam valendo).

  Na prática, quando o dono mescla a própria PR sem aprovação de ninguém, o
  `gh pr merge` **sem flag nenhuma falha** (`the base branch policy
  prohibits the merge`) — a CLI não aciona bypass sozinha. Use
  `gh pr merge --merge --admin`, ou o botão "Merge without waiting for
  requirements to be met" na interface do GitHub.
- **`homolog`** é a branch de QA: recebe PR de qualquer branch de trabalho,
  mas nunca de `main` — o workflow `fluxo-branches` rejeita essa direção.
- Branches de trabalho saem de `homolog` (ou de `main`, se `homolog` já
  estiver com algo pendente) e seguem o padrão `tipo/descricao-curta`
  (`feat/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`, `test/…`).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), em
commits atômicos (um assunto lógico por commit). Validado automaticamente
pelo hook `commit-msg` (commitlint) e, na PR, pelo workflow `commitlint`.

Exemplos: `feat(simulador): …`, `fix(historico): …`, `refactor(tax): …`,
`chore(hooks): …`, `docs: …`, `test: …`.

## Antes de abrir a PR

```bash
npm run typecheck --workspaces --if-present
npm test
```

O hook de `pre-commit` (husky + lint-staged) já roda o typecheck de todos os
workspaces a cada commit que toca `.ts`/`.tsx`.

## Pull requests

Abra a PR para `homolog` (nunca direto para `main`). Preencha o template —
o que muda, como testar, checklist. Os checks de CI e o CODEOWNER
(`[CODEOWNERS](CODEOWNERS)`) precisam aprovar antes do merge.
