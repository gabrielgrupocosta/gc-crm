# GC CRM

CRM interno construido com Next.js e Supabase. A aplicacao usa Supabase Auth
para identidade e sessao, Postgres para dados, Storage privado para documentos
e uma Edge Function para manter os contratos REST consumidos pelo frontend.

## Arquitetura de producao

- Frontend: Next.js 14 na Vercel.
- Autenticacao: Supabase Auth.
- API: Supabase Edge Function `crm-api`.
- Banco: Supabase Postgres com Row Level Security (RLS).
- Arquivos: bucket privado do Supabase Storage.

O navegador autentica diretamente no Supabase Auth. Depois do login, o
frontend envia o access token do usuario em `Authorization: Bearer ...` e a
chave publica em `apikey`. As chamadas para `/api/*` sao reescritas pelo Next
para `/functions/v1/crm-api/*`.

A chave publica identifica a aplicacao, mas nao concede privilegios por si so.
A autorizacao efetiva deve permanecer nas policies RLS e nas validacoes da Edge
Function. Chaves secretas nunca podem estar no bundle do frontend, na Vercel ou
em arquivos versionados.

## Estrutura relevante

```text
src/                         frontend Next.js
src/lib/supabase/            clientes browser, server e middleware
supabase/migrations/         schema, funcoes, grants, RLS e Storage
supabase/functions/crm-api/  API compativel com as rotas atuais do CRM
middleware.js                renovacao da sessao no Next.js 14
```

O diretorio `backend/` representa a API anterior. Ele pode ser mantido durante
a janela de estabilizacao apenas para permitir rollback, mas nao faz parte da
arquitetura alvo.

## Variaveis de ambiente

### Frontend local e Vercel

Copie `.env.example` para `.env.local` e preencha apenas:

```text
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=CHAVE_PUBLICA_DO_PROJETO
```

Essas duas variaveis sao publicas por definicao. Nao adicione
`SUPABASE_SECRET_KEY`, senha do banco, connection string ou qualquer outra
credencial privilegiada ao projeto da Vercel.

### Edge Function

A funcao utiliza as seguintes variaveis no ambiente seguro do Supabase:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
CORS_ORIGIN
SUPABASE_STORAGE_BUCKET
```

Em ambientes que ainda fornecem as chaves legadas, a funcao tambem aceita
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Prefira as chaves atuais.
Configure `CORS_ORIGIN` com a origem exata do frontend de producao e, durante a
validacao, com as origens de preview estritamente necessarias.

Nunca coloque valores reais no README, em commits, tickets ou logs. Configure
segredos pelo painel do Supabase ou por um gerenciador de segredos autorizado.

## Desenvolvimento local do frontend

Requisitos:

- Node.js 20.
- npm.
- Supabase CLI para migrations e Edge Functions.

Instale as dependencias e inicie o frontend:

```bash
npm install
npm run dev
```

Validacoes locais:

```bash
npm run lint
npm run build
```

O build exige as duas variaveis `NEXT_PUBLIC_*`. O projeto usa Next.js 14;
portanto, a renovacao de sessao esta em `middleware.js`.

## Preparacao do Supabase

Antes de operar em producao:

1. Gere um backup verificavel do banco e registre as contagens das tabelas
   principais.
2. Confirme que esta conectado ao projeto correto.
3. Revise todas as migrations antes de aplica-las.
4. Nao execute seed, `db reset` ou comandos destrutivos no projeto de producao.

Conecte a CLI ao projeto correto:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
```

Confira as migrations pendentes e aplique-as:

```bash
npx supabase migration list
npx supabase db push
```

As migrations deste repositorio sao ordenadas e cobrem:

1. fundacao compativel com as tabelas existentes e vinculo com Auth;
2. funcoes de autorizacao, grants e RLS;
3. operacoes transacionais;
4. bucket privado e policies de Storage.

O backend anterior usa uma conexao administrativa e pode continuar funcionando
durante a janela de rollback. Isso nao substitui a validacao das policies para
usuarios `authenticated`.

## Importacao e vinculo de usuarios no Supabase Auth

Os registros da tabela de usuarios do CRM nao sao, por si so, identidades do
Supabase Auth. Cada usuario ativo precisa de uma identidade em `auth.users` e o
UUID correspondente precisa estar em `public."User"."authUserId"`.

Ordem recomendada:

1. Aplique as migrations para criar o campo e as funcoes de autorizacao.
2. Crie as identidades pelo fluxo administrativo seguro do Supabase Auth.
3. Use convite, recuperacao de senha ou senha temporaria comunicada fora do
   sistema. Nao copie hashes de senha do backend antigo para o Auth.
4. Vincule cada identidade ao perfil existente usando o UUID do Auth.
5. Verifique duplicidade de e-mail e confirme que todo usuario ativo foi
   vinculado.
6. Teste primeiro um administrador e depois um usuario de cada perfil.

Consulta de verificacao, sem alterar dados:

```sql
select count(*) as usuarios_ativos_sem_auth
from public."User"
where "deletedAt" is null
  and "authUserId" is null;
```

O resultado precisa ser zero antes do corte. A importacao deve ser idempotente e
nao deve criar um segundo perfil para um usuario ja existente.

## Deploy da Edge Function

Depois das migrations e do vinculo inicial de Auth:

1. Configure as variaveis seguras da funcao.
2. Confirme o bucket privado configurado.
3. Revise `supabase/config.toml`. A funcao faz validacao explicita do JWT e das
   chaves, por isso a configuracao de `verify_jwt` deve ser alterada somente com
   revisao de seguranca.
4. Publique a funcao:

```bash
npx supabase functions deploy crm-api
```

5. Consulte os logs e valide que nenhuma credencial, token ou dado pessoal esta
   sendo registrado.
6. Com um token de teste valido, confirme que `GET /auth/me` retorna o perfil
   correto. Sem token, a mesma rota deve responder `401`.

## Deploy do frontend na Vercel

1. Configure as duas variaveis publicas `NEXT_PUBLIC_*` no ambiente de preview.
2. Gere um deployment de preview.
3. Execute todos os smoke tests abaixo.
4. Configure as mesmas variaveis no ambiente de producao.
5. Promova o deployment validado para producao.
6. Mantenha o deployment anterior e a API anterior disponiveis durante a janela
   de estabilizacao.

Alterar as variaveis publicas exige um novo build do Next.js. Nunca reutilize o
build de outro projeto Supabase.

## Ordem completa do corte

1. Backup do banco e inventario das contagens atuais.
2. Aplicacao das migrations Supabase.
3. Importacao das identidades Auth e vinculo por `authUserId`.
4. Verificacao de usuarios ativos sem vinculo.
5. Configuracao dos segredos e deploy da `crm-api`.
6. Smoke test direto da Edge Function.
7. Deployment de preview do frontend.
8. Smoke test funcional e de autorizacao no preview.
9. Promocao do frontend para producao.
10. Monitoramento de Auth, Edge Function, Postgres, Storage e Vercel.
11. Desativacao da API anterior apenas depois do periodo de estabilidade.

## Smoke tests obrigatorios

Use registros de teste identificaveis e remova-os ao final. Nao use dados reais
desnecessariamente.

### Sessao e autenticacao

- Abrir `/login` sem atraso de inicializacao de servidor.
- Confirmar que credenciais invalidas nao criam sessao.
- Entrar com usuario valido e receber o perfil correto em `/api/auth/me`.
- Recarregar a pagina e confirmar que a sessao permanece ativa.
- Navegar entre paginas e confirmar que o token renovado continua valido.
- Sair, recarregar e confirmar redirecionamento para `/login`.
- Chamar uma rota protegida sem token e confirmar `401`.

### Autorizacao

- Administrador acessa usuarios, unidades e todos os modulos.
- Gestor acessa somente unidades, equipe e clientes permitidos.
- Vendedor acessa somente a propria carteira e propostas autorizadas.
- Financeiro acessa somente operacoes financeiras permitidas.
- Colaborador enxerga apenas os modulos concedidos na matriz de permissoes.
- Tentativa de acessar outra unidade por URL ou payload deve retornar `403` ou
  nenhum registro, conforme o contrato da rota.
- Criar, editar e excluir deve respeitar cada acao da matriz de permissoes.

### Fluxos funcionais

- Dashboard, alertas e rankings carregam sem erro.
- Listar, criar, editar e fazer soft delete de cliente.
- Mover um prospecto entre fases do funil.
- Criar e listar uma interacao.
- Criar, editar e remover um lancamento financeiro.
- Criar proposta e alterar status.
- Enviar um PDF, abrir a URL assinada, renomear e excluir o documento.
- Confirmar que o bucket nao fornece URL publica permanente.
- Validar avaliacoes, desempenho e telas de Customer Success.

### Integridade e seguranca

- Comparar contagens das tabelas principais antes e depois do corte.
- Confirmar que todo usuario ativo possui `authUserId` unico.
- Confirmar que arquivos existentes continuam associados aos documentos.
- Verificar que nenhuma chave secreta aparece no bundle, no Network do
  navegador ou nas variaveis da Vercel.
- Verificar logs de erro da Edge Function, Auth e Vercel.

## Rollback temporario

Nao remova a API anterior nem o deployment anterior durante o primeiro periodo
de estabilidade.

Se o corte apresentar falha critica:

1. Interrompa novas operacoes no CRM para evitar divergencia de dados.
2. Restaure na Vercel o deployment anterior, que ainda encaminha as chamadas
   para a API anterior.
3. Confirme login, leitura e escrita no fluxo anterior.
4. Preserve as migrations aditivas do Supabase; nao reverta schema ou apague
   identidades Auth automaticamente.
5. Corrija a Edge Function ou o frontend e repita os smoke tests em preview.
6. Refaca o corte somente depois da validacao.

Como as duas APIs usam o mesmo Postgres, evite manter escrita concorrente por
longos periodos. O rollback deve ser curto, controlado e acompanhado de
comparacao de contagens e registros alterados durante a janela.

## Observabilidade apos o corte

Durante a estabilizacao, acompanhe:

- falhas de login e renovacao de sessao;
- respostas `401`, `403`, `409` e `500` da Edge Function;
- latencia e erros das consultas Postgres;
- falhas de upload e geracao de URLs assinadas;
- consumo e limites do plano Supabase;
- erros de frontend e deployments da Vercel.

Nao registre tokens, senhas, chaves, connection strings ou documentos nos logs.
