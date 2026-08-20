# Publicação (Render + Turso)

Aliquo é um servidor Next com estado: banco SQLite com índice FTS5 e arquivos
de fatura enviados pelo usuário. **Nenhuma cloud gratuita oferece disco
persistente em 2026** — Fly.io encerrou o free tier, instância free do Koyeb não
aceita volume, disco no Render é só em plano pago. Um arquivo gravado no
container some no próximo restart.

A saída é tirar o estado do container:

| Estado | Onde fica | Por quê |
|---|---|---|
| Banco | Turso (libSQL) | fork do SQLite: FTS5, `bm25()` e as migrations continuam valendo |
| Faturas enviadas | tabela `ArquivoBlob` | mesma interface `FileStore`; nenhum chamador mudou |
| Bases oficiais (`var/base/`) | local, no seu computador | são insumo de importação, não dado de runtime |

O código escolhe sozinho: com `TURSO_DATABASE_URL` definida, o Prisma usa o
driver adapter libSQL e o `FileStore` passa a gravar no banco.

## 1. Preparar o arquivo do banco

```bash
npm run producao:preparar
```

Copia `prisma/dev.db` para `var/producao.db`, remove **todo** dado de usuário
(contas, simulações, faturas, anexos), roda `VACUUM` e confere que sobrou o que
importa: nomenclatura, alíquotas, ICMS por UF, planos e o índice FTS5. Se algo
faltar, o script falha em vez de publicar um banco pela metade.

Resultado esperado: ~21 MB, `usuários: 0`.

### Ensaio sem conta nenhuma

O driver adapter do libSQL também abre arquivo local. Dá para exercitar
exatamente o caminho de produção — adapter, FTS5, BLOB — antes de criar conta em
lugar algum:

```bash
TURSO_DATABASE_URL="file:var/producao.db" npx tsx scripts/verificar-banco.ts
TURSO_DATABASE_URL="file:var/producao.db" npm run build && npm run start
```

Com a variável definida, a aplicação já grava anexos em `ArquivoBlob` em vez de
`var/uploads/`. O que o ensaio NÃO cobre é o servidor do Turso — daí a
conferência do passo seguinte.

## 2. Criar o banco no Turso

Crie a conta em <https://turso.tech>. Dois caminhos, mesmo resultado.

**Pelo painel — sem instalar nada.** Crie um banco vazio, copie a URL
`libsql://...` e gere um token; ponha os dois no seu `.env` como
`TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` e carregue o arquivo preparado:

```bash
npx tsx scripts/publicar-banco.ts
```

O script lê `var/producao.db` pelo mesmo cliente libSQL que fala com o remoto e
recria lá schema, índices, dados e a tabela virtual FTS5 — conferindo, tabela a
tabela, se a contagem bate. Recusa rodar contra banco que já tem tabelas, para
não apagar dado de usuário por engano; `--forcar` é a saída consciente disso.

**Pela CLI**, se você já a tem instalada, dá para criar já cheio:

```bash
turso db create aliquo --from-file var/producao.db
```

Limite de 2 GB por arquivo; o plano free dá 5 GB de armazenamento. Banco criado
pelo painel nasce **vazio** — daí o script acima.

Pela CLI, as credenciais saem de:

```bash
turso db show aliquo --url
turso db tokens create aliquo
```

**Confira o banco remoto antes de seguir** — o FTS5 é a peça que justifica o
Turso em vez de Postgres:

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/verificar-banco.ts
```

O script percorre o mesmo caminho da aplicação (Prisma + driver adapter libSQL):
conta a base oficial, roda um `MATCH` com `bm25()` e faz round-trip de um BLOB.
Sai com código 1 se algo falhar.

Se o FTS5 falhar, **pare**: sem ele a recuperação de NCM não funciona, e a
alternativa é reescrever `src/lib/ncm/retrieval.ts` para outro motor de busca.

> Conferido em 20/08/2026 contra o Turso: o `CREATE VIRTUAL TABLE ... USING
> fts5` foi aceito e o `MATCH` com `bm25()` devolveu os **mesmos scores** do
> SQLite local (-14,59 / -14,58 / -14,56 para `aspirador*`). A ressalva se
> mantém no texto porque a Turso vem migrando para um motor de busca próprio
> baseado em Tantivy — se um dia o FTS5 sair, é aqui que se descobre.

## 3. Publicar no Render

O repositório precisa estar no GitHub/GitLab. O `render.yaml` na raiz já
descreve o serviço; no painel do Render, **New > Blueprint**, aponte para o
repositório e confirme.

Depois, em **Environment**, preencha as três variáveis marcadas como `sync:
false` — são os segredos, que ficam fora do repositório de propósito:

- `TURSO_DATABASE_URL` — a URL `libsql://...` do passo anterior
- `TURSO_AUTH_TOKEN` — o token do passo anterior
- `OLLAMA_API_KEY` — o mesmo valor do seu `.env` local

`AUTH_SECRET` é gerado pelo Render. `STORAGE_DRIVER=db`, o provider de IA
(`ollama` com `gpt-oss:120b`) e `LLM_PRECOS` já vêm no blueprint, iguais ao
ambiente de desenvolvimento.

Para confirmar que a chave está viva antes de colá-la no painel:

```bash
npx tsx scripts/verificar-llm.ts
```

Sem a chave do Ollama a aplicação **não quebra**: o classificador captura a
falha do provider e cai na recuperação pela base oficial — resultado degradado,
porém correto. Mas é degradação silenciosa, então confira o chat no passo 4.

Login com Google exige, além de `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, cadastrar
`https://<seu-app>.onrender.com/api/auth/callback/google` como redirect URI no
Google Cloud.

### O que esperar da instância free

- **Hiberna após ~15 min sem tráfego.** O primeiro acesso depois disso leva
  ~1 min para responder. É o custo do plano; um ping periódico mascara, mas
  consome as horas gratuitas.
- **512 MB de RAM.** Se o build estourar memória, defina
  `NODE_OPTIONS=--max-old-space-size=460`.
- Sem disco: nada de escrever em `var/` no servidor.
- **Chamada de IA sem timeout.** `src/lib/llm/ollama.ts` faz `fetch` sem
  `AbortSignal`: se o Ollama Cloud travar, a requisição fica pendurada até a
  plataforma cortar, ocupando a única instância. Vale um timeout antes de
  abrir para usuários de verdade.

## 4. Conferir o que subiu

Com a URL do Render no ar:

1. Criar conta e aceitar os termos.
2. Buscar uma NCM pelo chat — prova que o FTS5 remoto responde **e** que a
   chave do Ollama chegou (sem ela, a busca funciona mas não interpreta a
   descrição coloquial).
3. Rodar uma simulação e recarregar a página — prova que o banco persiste.
4. Anexar uma fatura e baixá-la de volta — prova que o `ArquivoBlob` funciona.
5. Fazer um deploy novo e repetir o passo 3 — prova que o dado sobrevive ao
   deploy, que é o ponto de toda esta migração.

## Credenciais no `.env` apontam TUDO para produção

Guardar `TURSO_DATABASE_URL` no `.env` é prático — e é uma faca. Com ela ali,
`npm run dev`, os scripts e qualquer `npx tsx` passam a falar com o banco de
produção, sem aviso. Dois pontos já estão protegidos:

- **A suíte de testes se recusa.** `vitest.setup.ts` esvazia a variável antes
  de qualquer import do Prisma e avisa no console; vários testes gravam e
  apagam registros, e eles fariam isso em produção. Para rodar contra o remoto
  de propósito: `PERMITIR_BANCO_REMOTO=1 npm test`.
- **`reset-teste.ts` se recusa.** Ele começa apagando todo dado de aplicação;
  contra o remoto isso não é reset, é perda. Exige `--forcar`.

O resto não tem rede de proteção. Se for desenvolver, comente as duas
variáveis no `.env` e passe-as no shell só quando quiser mesmo produção:

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/verificar-banco.ts
```

## Manutenção

**Atualizar a base oficial.** Rode os scripts apontando para produção; eles
usam o mesmo cliente Prisma da aplicação:

```bash
npm run base:import          # baixa e importa localmente primeiro
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run base:import
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run ncm:index
```

No PowerShell, `$env:TURSO_DATABASE_URL="libsql://..."` antes do comando.

**Mudar o schema.** `prisma migrate` não roda contra o Turso. O fluxo é: criar a
migration localmente (`npm run db:migrate`), conferir o SQL gerado — removendo
qualquer `DROP TABLE "NcmFts"`, que o diff insere por não enxergar tabela
virtual — e aplicar o mesmo SQL no remoto:

```bash
turso db shell aliquo < prisma/migrations/<nova>/migration.sql
```

**Backup.** `turso db dump aliquo > backup.sql`. O plano free guarda 1 dia de
point-in-time restore; um dump manual antes de cada mudança de schema custa
segundos.

## Se o Render não servir

- **Uso comercial:** o plano Hobby da Vercel proíbe uso comercial nos termos.
  Render free não tem essa restrição — foi o motivo da escolha.
- **Hibernação incômoda:** VM free da Oracle Cloud (Always Free) roda o app e o
  SQLite em disco de verdade, sem hibernar. O custo é operacional: máquina,
  deploy, TLS e backup por sua conta.
- **Uploads grandes:** trocar `dbFileStore` por Cloudflare R2 (10 GB grátis) é
  implementar `FileStore` com o SDK S3; nenhum chamador muda.
