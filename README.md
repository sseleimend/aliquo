# Aliquo — simulador de custo de importação

Simulador de landed cost para importação no Brasil: descobre a NCM na base
oficial, calcula os tributos com alíquotas publicadas e consolida o custo total
de nacionalização.

**Princípio que rege o código:** nenhuma NCM fora da base oficial, nenhuma
alíquota inventada. Quando o dado oficial não existe, o cálculo é **bloqueado**
em vez de estimado.

## Como rodar

```bash
npm install
npx prisma migrate deploy      # cria o banco e o índice FTS5
npm run base:import            # baixa e importa as bases oficiais (~4 MB)
npm run db:seed                # planos, alíquotas de ICMS e usuário demo
npm run dev                    # http://localhost:3000
```

Usuário demo: `demo@aliquo.com` / `demo123` (criado pelo seed, plano Pro).

Para um ambiente limpo de teste: `npx tsx scripts/reset-teste.ts` zera os dados de
aplicação (preservando a base oficial) e cria `teste@aliquo.com` / `teste-fase2`
no plano Pro.

```bash
npm test          # suíte completa
npm run ncm:eval  # mede o recall da recuperação de NCM, sem IA
```

## Bases oficiais

Três publicações independentes, com atos e vigências próprios. `npm run base:import`
baixa, versiona (sha256) e importa as três, reportando a cobertura ao final.

| Base | O que traz | Fonte |
|---|---|---|
| Nomenclatura NCM | códigos, descrições e hierarquia | Portal Único Siscomex (JSON) |
| TEC | alíquotas de **II** | Gecex/MDIC — Anexos I e II da Res. 272/2021 (XLSX) |
| TIPI | alíquotas de **IPI** | Receita Federal (XLSX) |

Cobertura atual: **10.515 NCMs de 8 dígitos, 100% com II e IPI oficiais.**

Flags: `--download` força novo download, `--offline` usa o que está em
`var/base/`, `--reprocessar` reimporta mesmo com arquivo idêntico (útil quando
a lógica de parsing muda), `--sem-ativar` importa sem tornar a versão ativa.

## Arquitetura

### Classificação de NCM — conjunto fechado

Alucinar um código é **estruturalmente impossível**, não apenas improvável:

1. **Expansão** — a IA traduz a descrição coloquial para o vocabulário da
   nomenclatura. O prompt proíbe códigos e a saída é filtrada de qualquer coisa
   parecida com NCM.
2. **Recuperação** — BM25 sobre FTS5 devolve candidatos reais da base, em dois
   estágios (posição → item), porque uma folha costuma ser só `-- Outros` e só
   é alcançável descendo a partir da posição.
3. **Ranqueamento** — a IA vê a lista numerada e responde com **índices**, nunca
   com códigos. Índice fora da faixa é descartado.

A desambiguação por atributo (RF-A2) é **determinística**: a pergunta é extraída
do texto oficial que separa os irmãos, então continua funcionando com a IA fora
do ar.

### Motor tributário — regras configuráveis

- **Estrutura** (quais tributos, sobre o que incidem, em que ordem) vive em
  módulos versionados em `src/lib/tax/rulesets/`.
- **Números** (alíquotas por NCM/UF) vivem no banco, alimentados pelas bases
  oficiais.

Cada simulação grava a versão do conjunto de regras, a versão da base e a
cotação usada — é o que a torna reproduzível meses depois (RNF-6).

O motor é **puro e síncrono**; toda a assincronia está em `src/lib/tax/contexto.ts`.

### Câmbio

Cadeia explícita, cada degrau deixando rastro: memória → cache em banco →
**PTAX/BCB** (fiscal) → AwesomeAPI (substituta) → cache obsoleto com aviso →
erro que exige taxa manual. Nunca inventa uma taxa.

A taxa usada no cálculo é a **PTAX de venda do dia útil anterior** — a base
legal para valoração aduaneira, não a cotação de mercado do instante.

### Reuso de importações

**A fonte de reuso é o histórico.** Começar do que já foi importado traz
produtos, NCMs confirmadas, quantidades, custos e o critério de rateio. Dois pontos
de entrada, um mecanismo só (`src/components/simulador/duplicar.ts`):

- botão **"Usar como base"** no histórico → `/simulador?duplicar=<id>`
- aba **"Reusar do histórico"** no passo 1 do simulador

O reuso copia apenas a **entrada**. Câmbio e alíquotas são resolvidos de novo no
cálculo — reapresentar um número de semanas atrás como atual é o oposto do que
a Fase 2 se propõe.

**Fatura comercial (RF-D2) não tem UI.** O campo foi removido do fluxo a pedido
do produto. O backend continua completo e testado — modelo `Invoice`, rotas em
`/api/invoices`, `FileStore` gravando em `var/uploads/` fora de `public/`, e o
`invoiceId` acompanhando o reuso. Basta reintroduzir um componente de anexo
para religá-lo; nada foi apagado do banco.

### Migração de histórico

Quem vem de outra ferramenta traz as importações antigas pelo histórico:
**Baixar modelo (Excel)** → preencher → **Anexar arquivo**.

O formato é **uma linha por item**, agrupadas pela coluna Referência — é como
as planilhas que as pessoas já mantêm costumam estar. As colunas são lidas pelo
título, então remanejá-las não quebra nada.

Os tributos são **recalculados com as alíquotas oficiais de hoje**, nunca
copiados do sistema de origem: um número que não podemos justificar contra uma
fonte oficial é exatamente o que a Fase 2 existe para eliminar. Se você tem o
custo apurado pela ferramenta anterior, a coluna *Landed cost original* o
guarda como referência, sem misturar com o nosso cálculo. Registros migrados
entram como `arquivada`, distinguindo histórico trazido de simulação feita aqui.

**PDF e Excel gerados pelo Aliquo voltam sem perda.** O PDF carrega os dados
nos metadados (`/AliquoDados`, base64) e o Excel numa aba no formato do
modelo — nunca no layout, que quebraria a cada ajuste visual. **PDF de outra
ferramenta é recusado** com mensagem explícita: adivinhar números a partir de
um layout arbitrário produziria custo fiscal inventado.

### Custo de IA (RNF-5)

Dois modelos de cobrança convivem, e tratá-los como um só produz número errado:

- **por token** (Anthropic, Gemini) — calculável na hora da chamada
- **assinatura** (Ollama Cloud) — mensalidade fixa com limite de GPU-time, sem
  preço por token; o custo por simulação só existe rateando a mensalidade pelo
  volume do mês

Por isso o evento guarda o que é **fato** (tokens, provider, modelo) e o custo
fica `null` quando não é calculável na hora — nunca 0, que é um custo de
verdade. Preços vêm de `LLM_PRECOS` (JSON), porque mudam sem aviso e variam
por contrato; nada é chutado no código.

`npm run custo:ia` separa **fixo** de **variável** e projeta a margem. A
distinção importa: assinatura não se multiplica pelo número de simulações, e
somar tudo antes de extrapolar pelo teto do plano produz um custo dezenas de
vezes maior que o real.

## Índice FTS5

`NcmFts` é uma tabela virtual **não gerenciada pelo Prisma** — um índice
derivado e descartável de `NcmNomenclatura` + `NcmSinonimo`.

Ao gerar novas migrations, o Prisma vai querer emitir `DROP TABLE "NcmFts"`.
Remova essa linha do SQL gerado e rode `npm run ncm:index` para reconstruir
(leva segundos). Em runtime, se o índice sumir, a busca degrada para `LIKE`
com aviso visível em vez de quebrar.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run base:import` | importa nomenclatura + alíquotas + índice |
| `npm run ncm:index` | reconstrói só o índice FTS5 |
| `npm run ncm:eval` | recall da recuperação contra o conjunto dourado |
| `npx tsx scripts/verificar-e2e.ts` | pipeline completo, do texto ao PDF |
| `npx tsx scripts/verificar-invoice-duplicar.ts` | fatura (API) e reuso pelo histórico |
| `npm run custo:ia [AAAA-MM]` | custo de IA por simulação e margem do plano |
| `npm run verificar:migracao` | template, importação por planilha e round-trip do PDF |
| `npx tsx scripts/reset-teste.ts` | zera dados de aplicação e cria conta Pro de teste |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + SQLite (FTS5) ·
Auth.js · Vitest · pdfkit · exceljs.

Provider de IA configurável por `LLM_PROVIDER` (`mock` | `ollama` | `anthropic`
| `gemini`). Com `mock` não há chamada de rede e a classificação usa apenas a
busca na base oficial — degradada, porém correta.

## Limites conhecidos

- **ICMS** usa alíquotas gerais estimadas por UF; não captura benefícios
  estaduais de importação (TTD/SC, regimes de GO/ES), que mudam a alíquota
  efetiva em mais de 10 pontos. É o ponto do cálculo com maior margem de erro.
- **Ex-tarifários e listas de exceção** (BK/BIT) são importados e sinalizados,
  mas não aplicados automaticamente.
- **IBS/CBS** entra como CBS em fase de teste; o cálculo dual da transição
  depende de pesquisa das regras de 2026–2033.
- **RF-D2 (fatura comercial)** existe só na API: o campo saiu da interface a
  pedido do produto. Reintroduzir é escrever um componente de anexo.
- **Preços de IA e dos planos** em `LLM_PRECOS` e no seed são valores a
  confirmar — os do seed (R$ 149 / R$ 499) são placeholders, não uma decisão
  de negócio.
- Termos de uso e política de privacidade são texto base e precisam de revisão
  jurídica antes de operação comercial.
