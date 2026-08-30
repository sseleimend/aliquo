# apps/landing

Landing page pública do Aliquo — Next.js 15 (App Router) + TypeScript +
Tailwind, sem backend próprio (o cadastro, login e o produto vivem em
`apps/simulador`).

O design de referência está em [`design/design.pen`](design/design.pen)
(abra com o app Pencil/pen.dev) e o roteiro de copy em
[`design/copy-pt-br.md`](design/copy-pt-br.md) — leia este último antes de
mexer em qualquer texto da página: ele documenta de onde vem cada alegação
(README do simulador, `prisma/seed.ts`, `src/lib/plans`, `src/lib/billing`) e
por que algumas seções (depoimentos, métricas de uso) são placeholders
propositais em vez de conteúdo inventado.

## Como rodar

Parte do monorepo `aliquo` (`npm workspaces`) — `npm install` sempre na raiz,
nunca aqui dentro.

```bash
cd ../..                              # raiz do repo, se ainda não estiver lá
npm install
npm run dev --workspace=apps/landing  # http://localhost:3000
```

```bash
npm run build --workspace=apps/landing
npm run typecheck --workspace=apps/landing
```

## Variáveis de ambiente

| Variável | Uso | Padrão |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Base para os links de Entrar/Criar conta/Termos/Privacidade, que apontam para `apps/simulador` (deploy separado) | `https://app.aliquo.com` |

## Estrutura

- `src/components/` — uma seção da página por arquivo (Header, Hero,
  Features, Pricing, Faq etc.), na mesma ordem em que aparecem em
  `src/app/page.tsx`.
- `tailwind.config.ts` — tokens de cor/tipografia/raio extraídos 1:1 do
  `design.pen` (`GetVariables()`). É um design system próprio da landing,
  deliberadamente diferente da linguagem visual "despacho" do app
  (`apps/simulador/tailwind.config.ts`) — a página de marketing usa a
  identidade que veio do template aprovado.

## Convenções do monorepo

- Commits em Conventional Commits, PR sempre para `homolog` (nunca direto pra
  `main`) — ver [CONTRIBUTING.md](../../CONTRIBUTING.md) na raiz.
