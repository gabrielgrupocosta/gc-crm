# GC CRM

CRM com frontend Next.js, API Express/TypeScript, Prisma e PostgreSQL.

## Arquitetura de producao

- Frontend: Vercel
- Backend: Render
- Banco: Supabase Postgres
- Anexos: bucket privado do Supabase Storage

O frontend encaminha chamadas de `/api/*` para a API definida em `BACKEND_URL`. Nenhuma chave secreta do Supabase deve ser configurada na Vercel ou exposta com prefixo `NEXT_PUBLIC_`.

## Desenvolvimento local

Requisitos: Node.js 20 e PostgreSQL.

1. Copie `.env.example` para `.env`.
2. Copie `backend/.env.example` para `backend/.env` e preencha as variaveis.
3. Instale as dependencias com `npm install` na raiz e em `backend`.
4. No backend, execute `npm run prisma:deploy` e `npm run dev`.
5. Na raiz, execute `npm run dev`.

## Supabase

Em **Project Settings > Database > Connect**, copie:

- a URL do transaction pooler (porta 6543) para `DATABASE_URL`, com `pgbouncer=true&connection_limit=1`;
- a URL da conexao direta ou session pooler (porta 5432) para `DIRECT_URL`.

As duas URLs precisam conter a senha do banco. A chave secreta da API nao substitui essas URLs.

Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e, opcionalmente, `SUPABASE_STORAGE_BUCKET`. Depois crie o bucket privado uma vez:

```bash
cd backend
npm run supabase:setup
```

Crie as tabelas com:

```bash
cd backend
npm run prisma:deploy
```

O seed apaga os dados existentes antes de inserir dados de demonstracao. Use `npm run prisma:seed` somente em um banco descartavel.

## Render

O arquivo `render.yaml` define o servico. No Render, configure:

- `DATABASE_URL`
- `DIRECT_URL`
- `CORS_ORIGIN` com a URL da Vercel
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

O `JWT_SECRET` e gerado pelo blueprint. O health check fica em `/health`.

## Vercel

Importe a raiz do repositorio como projeto Next.js e configure:

```text
BACKEND_URL=https://SEU-SERVICO.onrender.com
```

Depois de alterar `BACKEND_URL`, faca um novo deploy para atualizar os rewrites.
