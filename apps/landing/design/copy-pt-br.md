# Copy da landing page — Aliquo (PT-BR)

Base: README de `apps/simulador`, homepage pública já existente
(`apps/simulador/src/app/page.tsx`), `prisma/seed.ts`, `src/lib/plans`,
`src/lib/billing`. Princípio de marca a preservar: **mostrar o dado real em
vez de prometer com adjetivo** (é a frase que já está no comentário da
homepage atual).

Decisões já validadas com o usuário:
- Depoimentos / logos de clientes / métricas de uso → **placeholder óbvio**,
  não inventar cliente nem número de uso.
- Preços → usar os valores do seed (Gratuito / Pro R$149 / Business R$499),
  mesmo sendo "a confirmar" no README — é a única fonte de verdade hoje.
- Descoberta nova (não perguntada, decisão de implementação): sem checkout
  automático → CTA de planos pagos vira "Falar com a gente", e o toggle
  Mensal/Anual do template some (não existe desconto anual no produto).

---

## 1. Header

- Nav: `Produto` · `Recursos` · `Preços` · `FAQ`
- `Entrar`
- CTA: `Criar conta grátis`

## 2. Hero

- Badge: `10.515 NCMs · 100% com II e IPI oficiais`
- Headline: **"O custo da sua importação, com a fonte de cada alíquota à
  vista."**
- Subhead: "Descubra a NCM na base oficial da Receita, calcule II, IPI, PIS,
  COFINS e ICMS com as alíquotas publicadas, e chegue ao custo total de
  nacionalização — sabendo de onde veio cada número."
- CTA primária: `Criar conta grátis`
- CTA secundária: `Ver uma simulação real` (âncora para a seção de
  Classificação de NCM, que traz a amostra do documento)
- Reforço: "Sem cartão de crédito · Plano gratuito com 5 simulações por mês ·
  Resultado em minutos"

### Preview do produto (mockup ilustrativo)

- Sidebar: `Nova simulação` · `Histórico` · `Despachantes` · `Conta`
- Widget de cota: "37 de 100 simulações usadas este mês" + barra
- Topbar: "Histórico de importações" (24)
- Chips: `Status` · `NCM` · botão `Nova simulação`
- Stats:
  - "Custo total nacionalizado" — R$ 428.750,00 · "+12% vs. mês anterior"
  - "NCMs confirmados" — 18 · "3 aguardando revisão"
  - "Simulações este mês" — 37 · "63 restantes no plano"
- Tabela: colunas `NCM` · `Produto` · `Status` · `Câmbio` · `Custo total`
  - linha exemplo: `8508.11.00` · Aspirador de pó doméstico · Confirmado ·
    R$ 5,42 · R$ 42.180,00

> Dados de exemplo, deixo claro no comentário do código que é mockup — não é
> tela de cliente real.

## 3. Social Proof — **placeholder óbvio**

- "[Placeholder] Ainda não publicamos clientes reais aqui. Esta faixa entra
  em produção só quando tivermos os primeiros nomes autorizados a aparecer."
- Logos: `[Logo do cliente]` × 4–6 (bloco cinza, sem nome inventado)

## 4. Problema & Transformação

- Eyebrow: `O PROBLEMA`
- Título: "Cada tributo calculado à mão é uma alíquota que pode estar
  desatualizada."
- Sub: "Alíquota errada não aparece na hora — aparece na autuação, ou no
  preço que não fecha. O Aliquo troca a planilha e a memória por base
  oficial e cálculo reproduzível."

**Hoje**
1. A NCM é escolhida "de olho", ou copiada da última importação parecida.
2. A alíquota de II e IPI vem de memória ou de uma tabela baixada há meses.
3. O câmbio usado no cálculo não é o mesmo exigido na valoração aduaneira.
4. Cada simulação vira uma planilha nova, sem como provar de onde veio o
   número depois.

**Com o Aliquo**
1. A IA sugere candidatos reais da nomenclatura oficial — nunca um código
   inventado.
2. II e IPI vêm da TEC e da TIPI publicadas, por NCM, sempre na versão
   vigente.
3. O câmbio é a PTAX de venda do dia útil anterior, a mesma base legal da
   valoração aduaneira.
4. Cada simulação grava a versão da base, do câmbio e das regras usadas —
   reproduzível meses depois.

## 5. Features (bento, 4 blocos)

**5.1 — Classificação de NCM** (bloco grande)
- Pill: `Conjunto fechado`
- Título: "A IA nunca inventa um código de NCM"
- Texto: "Você descreve o produto em português comum. A busca recupera
  candidatos reais da base oficial (Siscomex) e a IA só ordena o que já
  existe — nunca gera um código do zero. Fora da lista recuperada, não
  existe resposta possível."
- Prova: "10.515 NCMs de 8 dígitos na base, 100% com II e IPI oficiais"
- Preview: reaproveita a amostra da homepage atual — NCM `8508.11.00`, texto
  oficial "Aspiradores. > Com motor elétrico incorporado: > De potência não
  superior a 1.500 W e cujo volume do reservatório não exceda 20 l", II 20%
  (TEC — Res. Gecex 272/2021), IPI 6,5% (TIPI — Decreto 11.158/2022).

**5.2 — Motor tributário**
- Tag: `Tributos`
- Título: "Cada alíquota aponta para a fonte que a definiu"
- Texto: "Imposto de Importação, IPI, PIS, COFINS e ICMS aparecem com a
  alíquota, a base legal, o ato normativo e a data de vigência — na tela e
  no PDF. Sem dado oficial, o cálculo é bloqueado em vez de estimado."

**5.3 — Custo total e exportação**
- Tag: `Landed cost`
- Título: "O custo total de nacionalização, pronto para exportar"
- Texto: "Frete, seguro, Siscomex, THC, armazenagem, honorários do
  despachante e tributos se consolidam em um único número. Exporte em PDF ou
  Excel — e reimporte no Aliquo sem perder um dado, porque o documento
  carrega os seus próprios dados junto."

**5.4 — Histórico e migração**
- Tag: `Histórico`
- Título: "Comece a próxima simulação a partir da última"
- Texto: "Reuse produtos, NCMs confirmadas e critério de rateio de uma
  importação anterior — câmbio e alíquotas são sempre recalculados na hora,
  nunca copiados. Migrando de outra planilha? Baixe o modelo, preencha e
  anexe: os tributos são recalculados com as alíquotas oficiais de hoje."
- "Logos" (trocado por fontes oficiais reais, não ferramentas de terceiro):
  `Receita Federal` · `Siscomex` · `Gecex/MDIC` · `Banco Central (PTAX)`

## 6. Como funciona (3 passos)

1. **Descreva o produto ou informe o NCM** — "Digite a descrição em
   português comum ou já informe o código, se souber. Sem NCM certa, não tem
   cálculo certo — por isso começamos por aqui." · nota: "Leva menos de um
   minuto"
2. **Informe itens, frete, seguro e custos** — "Quantidade, valor, frete
   internacional, seguro, honorários do despachante e custos recorrentes
   como Siscomex e THC entram na simulação." · nota: "Reuse dados de uma
   importação anterior para ir mais rápido"
3. **Revise o cálculo e exporte** — "II, IPI, PIS, COFINS e ICMS aparecem
   com a fonte de cada alíquota. Exporte em PDF ou Excel, ou salve no
   histórico para reusar depois." · nota: "PDF e Excel prontos para anexar
   ao processo"

## 7. Testimonials & Metrics — **placeholder óbvio**

- Eyebrow: `RESULTADOS`
- Título: "Medido no seu próprio cálculo, não em promessa"
- Sub: "[Placeholder] Métricas reais de uso entram aqui assim que tivermos
  volume suficiente para publicar com confiança."
- Métricas: `[000]` / `[métrica real, ex.: horas economizadas por
  simulação]` × 4
- Depoimentos: `"[Depoimento real de cliente entra aqui — não publicar antes
  de ter autorização]"` / `[Nome]`, `[Cargo, Empresa]` × 3

## 8. Objeções (respostas reais, sem certificação inventada)

1. **Sem cartão para começar** — "O plano Gratuito não pede cartão. Você
   testa 5 simulações por mês sem compromisso."
2. **Seus dados de importação continuam seus** — "Suas faturas e
   simulações ficam na sua conta. A descrição do produto pode passar por um
   provedor de IA só para ajudar a localizar a NCM — o código final vem
   sempre da base oficial, nunca do modelo."
3. **Nada para migrar** — "Já importa por planilha? Baixe o modelo, preencha
   e anexe. O landed cost antigo fica só como referência; os tributos são
   recalculados com as alíquotas de hoje."
4. **Sem contrato de fidelidade** — "Mude de plano ou cancele quando fizer
   sentido para o seu volume — é só pedir."
5. **Nenhuma alíquota inventada** — "Sem base oficial publicada para o seu
   NCM, o Aliquo bloqueia o cálculo em vez de estimar. Você nunca decide sem
   saber a fonte."
6. **Cobertura da base, sem esconder o limite** — "10.515 NCMs de 8 dígitos,
   100% com II e IPI oficiais. ICMS por UF ainda é estimativa — e isso
   aparece marcado no seu resultado, não escondido."

**Trust bar** (substitui SOC2/GDPR/uptime fictícios por fatos reais e
verificáveis):
- `Fonte: Receita Federal, Siscomex e Gecex/MDIC`
- `Câmbio oficial PTAX/BCB`
- `Cálculo reproduzível — versão da base e das regras registrada`
- `Sem alíquota inventada`

## 9. Preços

- Eyebrow: `PREÇOS`
- Título: "Um plano para cada volume de importação"
- Sub: "Preços mensais, sem taxa de adesão. Os valores ainda podem mudar
  enquanto ajustamos os planos ao mercado."
- **Sem toggle Mensal/Anual** (não existe no produto — removido do
  template).

| | Gratuito | Pro | Business |
|---|---|---|---|
| Preço | R$ 0 /mês | R$ 149 /mês | R$ 499 /mês |
| Descrição | "Para testar o cálculo antes de decidir." | "Para quem importa com frequência e precisa de mais volume." | "Para operações com muitos itens e sem limite de simulação." |
| Simulações/mês | 5 | 100 | Ilimitadas |
| Itens por importação | 1 | 20 | 200 |
| Consultas de NCM por IA/mês | 20 | 500 | Ilimitadas |
| Exportação em PDF | ✓ | ✓ | ✓ |
| Upload de fatura comercial | — | ✓ | ✓ |
| CTA | `Criar conta grátis` | `Falar com a gente` | `Falar com a gente` |
| Destaque | — | `Mais usado` | — |

- Nota de rodapé: "O plano Gratuito é 100% self-service, sem cartão. A
  ativação do Pro e do Business é feita pela nossa equipe — sem checkout
  automático por enquanto."

## 10. FAQ

1. **O plano gratuito é mesmo gratuito?** — "Sim. Cinco simulações por mês,
   sem cartão e sem prazo para virar cobrança. Para mais volume, Pro e
   Business são ativados pela nossa equipe."
2. **Como funciona a cobrança dos planos pagos?** — "Hoje a ativação do Pro
   e do Business é manual: você fala com a gente, combinamos o plano e
   liberamos o acesso na sua conta. Ainda não temos checkout automático."
3. **Posso cancelar ou trocar de plano depois?** — "Sim, é só pedir — não
   tem contrato de fidelidade nem multa."
4. **De onde vêm as alíquotas de II, IPI, PIS, COFINS e ICMS?** — "II e IPI
   vêm da TEC (Gecex/MDIC) e da TIPI (Receita Federal), por NCM. PIS/COFINS
   seguem a legislação vigente. ICMS por UF ainda é uma estimativa geral —
   não existe tabela oficial consolidada dos 27 estados, e isso aparece
   marcado no resultado."
5. **O que acontece quando não existe alíquota oficial para o meu NCM?** —
   "O cálculo é bloqueado, não estimado. É melhor descobrir que falta um
   dado agora do que confiar num número que ninguém consegue justificar
   depois."
6. **A IA pode classificar minha NCM errada?** — "A IA nunca inventa um
   código: ela só ordena candidatos reais recuperados da base oficial.
   Quando dois códigos são parecidos, o Aliquo pergunta o atributo que
   oficialmente separa um do outro — essa pergunta continua funcionando
   mesmo com a IA fora do ar."

- Nota: "Ainda com dúvida? Escreva para contato@aliquo.com — um humano
  responde."

## 11. CTA final

- Headline: "Pare de estimar. Comece a calcular com fonte."
- Sub: "Crie sua conta gratuita e descubra a NCM, os tributos e o custo
  total da sua próxima importação em minutos."
- Botão: `Criar conta grátis`
- Reforços: "Sem cartão de crédito" · "5 simulações grátis por mês" ·
  "Cancele quando quiser"

## 12. Footer

- Descrição da marca: "Aliquo é o simulador de landed cost para importação
  no Brasil: NCM na base oficial, tributos com alíquota publicada, custo
  total de nacionalização com a fonte de cada número."
- Badges (reais, sem certificação inventada): `Fonte oficial Siscomex · TEC
  · TIPI` · `Câmbio oficial PTAX/BCB`
- Colunas:
  - **Produto**: Visão geral · Classificação de NCM · Motor tributário ·
    Custo total · Histórico e migração
  - **Empresa**: Sobre · Contato · Carreiras
  - **Recursos**: Central de ajuda · Novidades
  - **Legal**: Política de Privacidade · Termos de Uso
    (linkam para `/privacidade` e `/termos`, que já existem em
    `apps/simulador`)
- Rodapé: "© 2026 Aliquo. Todos os direitos reservados." + links Privacidade
  / Termos (**sem** indicador "all systems operational" — não existe status
  page real).
