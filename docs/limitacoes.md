# Limitações conhecidas

O que o Aliquo **não** faz, por quê, e o que está no lugar enquanto isso.

Este documento existe porque a premissa do produto é conferibilidade. Um simulador que
esconde os próprios limites vale menos que uma planilha honesta: quem usa precisa saber
onde o número é sólido e onde ele é um ponto de partida. Cada item abaixo diz o que
falta, por que falta, qual a remediação em vigor, e o que fecharia o buraco.

**Última revisão:** 20/08/2026

---

## Resumo

Cada seção abaixo abre com um **Em resumo** em linguagem simples — dá para
entender o porquê de cada item sem saber nada de tributação. O detalhe técnico
vem depois.

| # | Limitação | Impacto no número | Remediação | Fecha com |
|---|---|---|---|---|
| 1 | Alíquota interna de ICMS por UF é estimativa | Pontos percentuais | Rotulada como estimativa + importador CSV | Compilar as 27 fontes |
| 2 | Lista de produtos do FECP não é modelada | Até 2 pontos | Usuário marca se incide | Tabela de NCMs por estado |
| 3 | Benefício estadual de importação | 10+ pontos | Usuário declara a carga efetiva | **Não fecha** — é por contribuinte |
| 4 | Ex-tarifários não são aplicados | Até 100% do II | 582 linhas capturadas, não usadas | Vincular ex à NCM na simulação |
| 5 | IBS não existe no cálculo | Depende da transição | CBS em alíquota de teste, rotulada | Regulamentação da LC 214/2025 |
| 6 | Custo efetivo assume aproveitamento integral dos créditos | Até o total dos créditos | Premissa dita na tela e no PDF | Perguntar o perfil de saída |
| 7 | Preços de plano e custo de IA | Nenhum — é de negócio | Números meus, marcados no código | Decisão sua |

---

## 1. A alíquota interna de ICMS por UF é estimativa

> **Em resumo.** Cada estado decide sozinho quanto cobra de ICMS, e não existe
> nenhum lugar onde os 27 publiquem esse número junto. Quem quiser a tabela certa
> tem que ir de estado em estado, um por um, e refazer isso toda vez que algum
> deles mudar. Esse trabalho não está feito — então o número que aparece na tela
> é um chute educado, e ele se apresenta como tal.

**O que falta.** A tabela em [`src/lib/tax/rates.ts`](../src/lib/tax/rates.ts) traz uma
alíquota geral por estado sem ato legal associado. É o ponto do cálculo com maior margem
de erro.

**Por que não deu para resolver.** Não existe tabela oficial consolidada das alíquotas
internas dos 27 estados. O CONFAZ harmoniza convênios e protocolos, mas não publica as
alíquotas internas — cada estado fixa a sua no próprio RICMS ou lei ordinária. É por isso
que toda "tabela ICMS" que se encontra na internet é agregador: alguém compilou 27 fontes
na mão e não assume responsabilidade pelo resultado.

Duas fontes que parecem resolver e não resolvem:

- **IBPT / De Olho no Imposto** — é carga tributária *aproximada* para exibição no cupom
  fiscal (Lei 12.741/2012), declaradamente estimativa. Trocar uma estimativa por outra com
  aparência de oficial é pior que a situação atual.
- **Blogs de tabela ICMS** — sem responsabilidade, sem versionamento, sem data de vigência.

**Remediação em vigor** (temporária):

- a estimativa aparece na tela **com o nome de estimativa**, nomeando a SEFAZ do estado
  como lugar de confirmação — não é uma nota de rodapé cinza, é um aviso destacado;
- a tabela vive em banco (`AliquotaUf`), versionada por vigência, e não no código;
- existe [`scripts/importar-aliquotas-uf.ts`](../scripts/importar-aliquotas-uf.ts) para
  carregar a tabela real quando ela existir, sem mudança de código:

  ```bash
  npx tsx scripts/importar-aliquotas-uf.ts tabela.csv --dry-run
  ```

  O importador **recusa** linha sem fonte e recusa a palavra "estimativa" no campo fonte —
  carregar dado sem procedência anularia o objetivo da carga. Ele fecha a vigência anterior
  em vez de sobrescrever, então simulação antiga continua reproduzível com a alíquota que
  valia no dia dela.

**O que fecha.** Compilar as 27 fontes uma vez (trabalho de pesquisa, não de código) ou
assinar conteúdo tributário versionado com responsabilidade contratual sobre a atualização.
Alguns estados facilitam — [SEFAZ-PE publica PDF consolidado](https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Tabelas/ALIQUOTAS_ICMS_atualizada.pdf),
[SEFAZ-RJ publica em página própria](https://portal.fazenda.rj.gov.br/pagamentos/aliquotas-internas/).
Outros exigem garimpar o decreto.

---

## 2. A lista de produtos do FECP não é modelada

> **Em resumo.** Alguns estados cobram uma taxa extra por cima do ICMS (1% a 2%)
> para financiar programas sociais — mas só em certos produtos, e cada estado tem
> a sua lista. Como não sabemos se o seu produto está na lista do estado dele, o
> sistema pergunta em vez de decidir sozinho. Antes ele somava a taxa em tudo, o
> que cobrava a mais de quem estava de fora.

**O que falta.** O adicional de combate à pobreza (FECP, FECOEP, FUNPOBREZA — o nome muda
por estado) não incide sobre tudo: cada estado define a lista de produtos sobre a qual ele
se aplica. O Aliquo não conhece essas listas.

**O que estava errado antes.** A tabela somava o adicional em **todo** produto. Para uma
NCM fora da lista do estado, o cálculo cobrava pontos percentuais a mais — e o total
aparecia como um número opaco (RJ "22%") que ninguém conseguia decompor para conferir.

**Remediação em vigor:**

- `aliquota` e `fecp` são campos separados no banco e na tela. O resultado mostra
  "20% + 2% FECP" em vez de 22% sem explicação;
- cada UF declara se o adicional incide de forma geral (entra por padrão) ou sobre lista
  restrita (só entra se o usuário confirmar);
- o usuário desmarca o adicional quando a NCM dele está fora da lista, direto no passo de
  custos e tributos.

O default preserva o comportamento anterior onde há evidência de aplicação geral (RJ, PR),
para não mudar silenciosamente resultados já gravados.

**O que fecha.** Uma tabela NCM × estado das listas do adicional. Mesmo problema de
procedência do item 1, com o agravante de ser muito maior.

---

## 3. Benefício estadual de importação — e este não fecha

> **Em resumo.** Vários estados dão desconto grande de ICMS para atrair
> importadores. Só que esse desconto não é regra pública que dá para consultar:
> é uma autorização que a sua empresa pediu e recebeu (ou não), com contrapartidas
> negociadas. Duas empresas importando o mesmo produto, no mesmo estado, no mesmo
> dia, pagam valores diferentes. Nenhuma tabela do mundo acerta isso — só você
> sabe qual é o seu caso, e é por isso que o sistema pergunta.

**O que falta.** TTD de Santa Catarina, COMEXPRODUZIR de Goiás, INVEST-ES do Espírito
Santo e equivalentes. Mudam a carga efetiva de ICMS em mais de dez pontos.

**Por que não é questão de dado.** Não é uma alíquota diferente que se possa tabelar. São
regimes que operam por **diferimento na entrada e crédito presumido na saída**, dependem de
**habilitação prévia do contribuinte**, têm contrapartidas (faturamento mínimo, porto de
entrada, tipo de operação) e podem ser revogados individualmente. Dois importadores do
mesmo produto, no mesmo estado, no mesmo dia, têm cargas diferentes. Nenhuma tabela acerta
isso — nem uma tabela perfeita.

**Remediação em vigor** (permanente, e é a resposta certa):

O importador declara. No passo de custos e tributos há "Tenho regime especial de importação
neste estado", onde ele informa a alíquota efetiva e identifica o regime. O número entra no
cálculo e o resultado registra a procedência — na tela e no PDF:

```
ICMS — Importação — SC        4%     informada por você — regime especial (TTD 409)
```

É a mesma regra que vale para o resto do produto: não inventar, e deixar claro de quem é
cada número. Um 4% sem etiqueta, no meio de um documento fiscal, passaria por dado oficial.

**Referência útil.** O CONFAZ mantém o registro dos benefícios unilaterais que os estados
tiveram que declarar pelo [Convênio ICMS 190/2017](https://www.confaz.fazenda.gov.br/legislacao/convenios).
Não automatiza nada, mas serve para o importador saber o que existe e o que pode pleitear.

---

## 4. Ex-tarifários são capturados, mas não aplicados

> **Em resumo.** Quando um equipamento não é fabricado no Brasil, o governo pode
> zerar o imposto de importação dele. Mas esse benefício vale para uma descrição
> bem específica dentro da NCM, não para a NCM inteira — e escolher a errada
> zeraria um imposto que você na verdade deve. O sistema prefere cobrar o valor
> cheio: se houver benefício aplicável, o número sai alto demais, e errar para
> cima é o lado seguro de errar num custo.

**O que falta.** A base tem **582 linhas de ex-tarifário** carregadas em `NcmAliquota`. O
cálculo as ignora: [`contexto.ts`](../src/lib/tax/contexto.ts) filtra `ex: ""`, ou seja,
usa apenas a alíquota cheia da NCM.

**Por quê.** O ex-tarifário reduz o II (frequentemente a zero) para bens de capital e de
informática **sem produção nacional equivalente**, e aplica-se a uma descrição específica
dentro da NCM — não à NCM inteira. Escolher o ex certo é decisão de classificação, não
consulta: exige comparar a descrição do ex com o produto real. Aplicar automaticamente o
primeiro ex de uma NCM produziria um II subestimado com cara de oficial, que é exatamente o
tipo de erro que a Fase 2 existe para eliminar.

**Remediação em vigor** (temporária): o cálculo usa a alíquota cheia. Isso **superestima** o
II quando há ex aplicável — erra para o lado conservador, que é o lado certo de errar num
custo de importação.

**O que fecha.** Uma etapa de seleção de ex no passo de confirmação da NCM: quando a NCM
tiver ex disponíveis, mostrar as descrições e deixar o usuário escolher, gravando a escolha
como decisão dele. O dado já está no banco; falta o fluxo.

---

## 5. IBS não existe no cálculo (RF-B2 parcial)

> **Em resumo.** A reforma tributária vai substituir vários impostos por dois
> novos, IBS e CBS. A CBS já entra no cálculo com a alíquota de teste de 2026 e
> aparece marcada como tal. O IBS ficou de fora porque as alíquotas e o
> cronograma da transição ainda não estavam definidos — e colocar número chutado
> daria uma resposta com cara de precisa que envelheceria em semanas.

**O que falta.** O cálculo dual IBS/CBS da reforma tributária. Hoje o conjunto de regras
[`br-2026-atual`](../src/lib/tax/rulesets/br-2026-atual.ts) traz a **CBS a 0,9%** como
alíquota de teste e **não traz IBS**.

**Por quê.** As alíquotas de referência do IBS e o cronograma de transição dependem de
regulamentação que não estava consolidada quando isto foi construído. Implementar com
números especulativos produziria um resultado que envelhece mal e parece preciso.

**Remediação em vigor:**

- a CBS aparece rotulada como **"CBS (fase de teste)"**, citando EC 132/2023 e LC 214/2025,
  e não se disfarça de tributo consolidado;
- a CBS de teste **não integra a base do ICMS**, como manda a transição;
- a arquitetura já é versionada por conjunto de regras: um `br-import-2027` entra como
  módulo novo, sem tocar no motor, e simulações antigas continuam reproduzíveis com as
  regras que valiam no dia.

**O que fecha.** As alíquotas de referência publicadas. O trabalho então é escrever um
ruleset, não refatorar o cálculo.

---

## 6. O custo efetivo assume que você aproveita todos os créditos

> **Em resumo.** Alguns impostos pagos na importação voltam como crédito — você
> abate do imposto que vai dever quando vender. Mas isso só funciona se você
> tiver imposto a pagar na venda. Quem exporta, vende com isenção, ou está
> começando, junta crédito sem ter onde usar: o dinheiro saiu e não voltou. O
> "custo efetivo" da tela assume o caso comum, em que o crédito é aproveitado
> por inteiro.

**O que falta.** O simulador não pergunta o que você faz com a mercadoria depois de
nacionalizar, então calcula `custo efetivo = custo total − créditos recuperáveis` assumindo
aproveitamento de 100%.

**Por que isso importa.** Crédito tributário não é dinheiro de volta, é o direito de abater
de um débito futuro. Sem débito, o crédito vira saldo na conta gráfica — ativo no balanço,
não redução de custo. Na simulação de referência isso são R$ 8.114,25 de diferença entre o
desembolso real e o número apresentado.

Há um caso que atinge importador de forma **estrutural**, não eventual: pela Resolução do
Senado nº 13/2012, mercadoria importada revendida para outro estado sai a **4%** de ICMS
interestadual. Quem credita 17–22% na entrada e debita 4% na saída acumula saldo credor em
toda operação, para sempre. Não é um mês ruim — é o desenho do regime.

Outros perfis afetados: exportadores (exportação é imune ao ICMS), vendas com isenção ou já
tributadas por substituição, e empresa em início de operação que importa antes de faturar.

**Remediação em vigor:** a premissa deixou de ser silenciosa.

- ao lado do custo efetivo, na tela: "assume aproveitamento integral";
- um bloco explicando quando isso não vale, com o caso dos 4% interestaduais nomeado;
- o mesmo texto viaja no PDF, que é o documento que circula fora da tela.

O número não mudou — mudou o que a pessoa entende ao ler. Para quem vende no mercado
interno com tributação normal, que é o caso comum, ele continua correto.

**O que fecha.** Perguntar o perfil de saída (mercado interno / interestadual / exportação /
isenta) e calcular o aproveitamento provável, mostrando separadamente o que reduz custo e o
que vira saldo credor. É modelagem de saída, não de importação — outro escopo.

---

## 7. Preços de plano e custo de IA são meus, não seus

> **Em resumo.** Quanto cobrar dos seus clientes e quanto a IA custa por mês são
> decisões suas, não minhas. Preenchi com números plausíveis para o sistema rodar
> e marquei todos como suposição. Nenhum deles saiu de uma conta de negócio.

**O que falta.** Decisão de negócio.

- os preços dos planos (R$ 149 / R$ 499) são placeholders que eu escolhi;
- `assinaturaUsdMes: 20` no modelo de custo de IA é uma suposição minha;
- o preço por token vem de `LLM_PRECOS` no `.env` e precisa refletir o seu contrato real.

**Remediação em vigor:** estão marcados como suposição no código, e o modelo de custo separa
FIXO de VARIÁVEL — só a parte variável escala com uso, e é ela que importa para margem.

**O que fecha.** Você definir. Nenhum código muda.

---

## O que NÃO é limitação

Vale registrar, porque parece problema e não é:

- **O câmbio não é "o mais recente".** É a PTAX de venda do **último dia útil anterior**,
  que é a taxa correta para valoração aduaneira. A cotação de mercado é buscada em paralelo
  só para mostrar divergência. Usar a taxa do instante seria mais moderno e mais errado.
- **Feriados no câmbio.** A busca anda para trás até achar boletim publicado, então feriado
  não quebra nem devolve taxa de outro dia sem avisar.
- **Arredondamento por item.** O total soma valores já arredondados por item, e não o
  contrário. É como uma DI real rateia por adição — a diferença de centavos contra o cálculo
  "exato" é o comportamento correto, não um bug.
- **PIS/COFINS sem crédito em lucro presumido.** Está certo: o regime cumulativo não gera
  crédito. Em lucro real os quatro tributos creditáveis aparecem.
