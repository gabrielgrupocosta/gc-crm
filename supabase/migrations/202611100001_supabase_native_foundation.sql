-- GC CRM - additive Supabase foundation.
--
-- This migration deliberately keeps every legacy table name, column name and
-- TEXT primary key intact so Prisma/Render can continue operating during the
-- rollout. It is safe to apply before Supabase Auth users are imported.

create schema if not exists private;
create schema if not exists extensions;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create extension if not exists pgcrypto with schema extensions;

-- Prisma's @default(uuid()) is a client-side default for these TEXT columns.
-- PostgREST inserts need a database-side default.
alter table public."User" alter column "id" set default gen_random_uuid()::text;
alter table public."Unidade" alter column "id" set default gen_random_uuid()::text;
alter table public."Cliente" alter column "id" set default gen_random_uuid()::text;
alter table public."Financeiro" alter column "id" set default gen_random_uuid()::text;
alter table public."Documento" alter column "id" set default gen_random_uuid()::text;
alter table public."Interacao" alter column "id" set default gen_random_uuid()::text;
alter table public."Proposta" alter column "id" set default gen_random_uuid()::text;
alter table public."AvaliacaoDesempenho" alter column "id" set default gen_random_uuid()::text;
alter table public."SnapshotUnidade" alter column "id" set default gen_random_uuid()::text;
alter table public."AnaliseCliente" alter column "id" set default gen_random_uuid()::text;
alter table public."Cancelamento" alter column "id" set default gen_random_uuid()::text;

-- Prisma also supplies updatedAt itself. Direct Data API inserts need defaults,
-- and every update path needs the same behavior as Prisma's @updatedAt.
alter table public."User" alter column "updatedAt" set default current_timestamp;
alter table public."Unidade" alter column "updatedAt" set default current_timestamp;
alter table public."Cliente" alter column "updatedAt" set default current_timestamp;
alter table public."Financeiro" alter column "updatedAt" set default current_timestamp;
alter table public."Documento" alter column "updatedAt" set default current_timestamp;
alter table public."Interacao" alter column "updatedAt" set default current_timestamp;
alter table public."Proposta" alter column "updatedAt" set default current_timestamp;
alter table public."AvaliacaoDesempenho" alter column "updatedAt" set default current_timestamp;
alter table public."SnapshotUnidade" alter column "updatedAt" set default current_timestamp;
alter table public."AnaliseCliente" alter column "updatedAt" set default current_timestamp;
alter table public."Cancelamento" alter column "updatedAt" set default current_timestamp;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new."updatedAt" := current_timestamp;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists "User_set_updatedAt" on public."User";
create trigger "User_set_updatedAt"
before update on public."User"
for each row execute function private.set_updated_at();

drop trigger if exists "Unidade_set_updatedAt" on public."Unidade";
create trigger "Unidade_set_updatedAt"
before update on public."Unidade"
for each row execute function private.set_updated_at();

drop trigger if exists "Cliente_set_updatedAt" on public."Cliente";
create trigger "Cliente_set_updatedAt"
before update on public."Cliente"
for each row execute function private.set_updated_at();

drop trigger if exists "Financeiro_set_updatedAt" on public."Financeiro";
create trigger "Financeiro_set_updatedAt"
before update on public."Financeiro"
for each row execute function private.set_updated_at();

drop trigger if exists "Documento_set_updatedAt" on public."Documento";
create trigger "Documento_set_updatedAt"
before update on public."Documento"
for each row execute function private.set_updated_at();

drop trigger if exists "Interacao_set_updatedAt" on public."Interacao";
create trigger "Interacao_set_updatedAt"
before update on public."Interacao"
for each row execute function private.set_updated_at();

drop trigger if exists "Proposta_set_updatedAt" on public."Proposta";
create trigger "Proposta_set_updatedAt"
before update on public."Proposta"
for each row execute function private.set_updated_at();

drop trigger if exists "AvaliacaoDesempenho_set_updatedAt" on public."AvaliacaoDesempenho";
create trigger "AvaliacaoDesempenho_set_updatedAt"
before update on public."AvaliacaoDesempenho"
for each row execute function private.set_updated_at();

drop trigger if exists "SnapshotUnidade_set_updatedAt" on public."SnapshotUnidade";
create trigger "SnapshotUnidade_set_updatedAt"
before update on public."SnapshotUnidade"
for each row execute function private.set_updated_at();

drop trigger if exists "AnaliseCliente_set_updatedAt" on public."AnaliseCliente";
create trigger "AnaliseCliente_set_updatedAt"
before update on public."AnaliseCliente"
for each row execute function private.set_updated_at();

drop trigger if exists "Cancelamento_set_updatedAt" on public."Cancelamento";
create trigger "Cancelamento_set_updatedAt"
before update on public."Cancelamento"
for each row execute function private.set_updated_at();

-- Auth linkage is nullable during the rolling migration. ON DELETE SET NULL
-- preserves CRM history if an Auth account is removed.
alter table public."User"
  add column if not exists "authUserId" uuid;

create unique index if not exists "User_authUserId_key"
  on public."User" ("authUserId")
  where "authUserId" is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'User_authUserId_fkey'
      and conrelid = 'public."User"'::regclass
  ) then
    alter table public."User"
      add constraint "User_authUserId_fkey"
      foreign key ("authUserId") references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'User_gestorId_fkey' and conrelid = 'public."User"'::regclass
  ) then
    alter table public."User"
      add constraint "User_gestorId_fkey"
      foreign key ("gestorId") references public."User"("id") on delete set null on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'User_unidadeId_fkey' and conrelid = 'public."User"'::regclass
  ) then
    alter table public."User"
      add constraint "User_unidadeId_fkey"
      foreign key ("unidadeId") references public."Unidade"("id") on delete set null on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Unidade_responsavelId_fkey' and conrelid = 'public."Unidade"'::regclass
  ) then
    alter table public."Unidade"
      add constraint "Unidade_responsavelId_fkey"
      foreign key ("responsavelId") references public."User"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Cliente_unidadeId_fkey' and conrelid = 'public."Cliente"'::regclass
  ) then
    alter table public."Cliente"
      add constraint "Cliente_unidadeId_fkey"
      foreign key ("unidadeId") references public."Unidade"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Cliente_vendedorId_fkey' and conrelid = 'public."Cliente"'::regclass
  ) then
    alter table public."Cliente"
      add constraint "Cliente_vendedorId_fkey"
      foreign key ("vendedorId") references public."User"("id") on delete set null on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Financeiro_clienteId_fkey' and conrelid = 'public."Financeiro"'::regclass
  ) then
    alter table public."Financeiro"
      add constraint "Financeiro_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Documento_clienteId_fkey' and conrelid = 'public."Documento"'::regclass
  ) then
    alter table public."Documento"
      add constraint "Documento_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Documento_propostaId_fkey' and conrelid = 'public."Documento"'::regclass
  ) then
    alter table public."Documento"
      add constraint "Documento_propostaId_fkey"
      foreign key ("propostaId") references public."Proposta"("id") on delete set null on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Interacao_clienteId_fkey' and conrelid = 'public."Interacao"'::regclass
  ) then
    alter table public."Interacao"
      add constraint "Interacao_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Interacao_responsavelId_fkey' and conrelid = 'public."Interacao"'::regclass
  ) then
    alter table public."Interacao"
      add constraint "Interacao_responsavelId_fkey"
      foreign key ("responsavelId") references public."User"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Proposta_clienteId_fkey' and conrelid = 'public."Proposta"'::regclass
  ) then
    alter table public."Proposta"
      add constraint "Proposta_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Proposta_vendedorId_fkey' and conrelid = 'public."Proposta"'::regclass
  ) then
    alter table public."Proposta"
      add constraint "Proposta_vendedorId_fkey"
      foreign key ("vendedorId") references public."User"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'AvaliacaoDesempenho_colaboradorId_fkey' and conrelid = 'public."AvaliacaoDesempenho"'::regclass
  ) then
    alter table public."AvaliacaoDesempenho"
      add constraint "AvaliacaoDesempenho_colaboradorId_fkey"
      foreign key ("colaboradorId") references public."User"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'AvaliacaoDesempenho_avaliadorId_fkey' and conrelid = 'public."AvaliacaoDesempenho"'::regclass
  ) then
    alter table public."AvaliacaoDesempenho"
      add constraint "AvaliacaoDesempenho_avaliadorId_fkey"
      foreign key ("avaliadorId") references public."User"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'SnapshotUnidade_unidadeId_fkey' and conrelid = 'public."SnapshotUnidade"'::regclass
  ) then
    alter table public."SnapshotUnidade"
      add constraint "SnapshotUnidade_unidadeId_fkey"
      foreign key ("unidadeId") references public."Unidade"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'AnaliseCliente_clienteId_fkey' and conrelid = 'public."AnaliseCliente"'::regclass
  ) then
    alter table public."AnaliseCliente"
      add constraint "AnaliseCliente_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'Cancelamento_clienteId_fkey' and conrelid = 'public."Cancelamento"'::regclass
  ) then
    alter table public."Cancelamento"
      add constraint "Cancelamento_clienteId_fkey"
      foreign key ("clienteId") references public."Cliente"("id") on delete restrict on update cascade;
  end if;
end;
$$;

notify pgrst, 'reload schema';

-- Conditional/idempotent backfill. Before the import this updates zero rows;
-- after the import the administrative script performs the same linkage.
update public."User" as crm_user
set "authUserId" = auth_user.id
from auth.users as auth_user
where crm_user."authUserId" is null
  and case
    when crm_user.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then crm_user.id::uuid
    else null
  end = auth_user.id;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'NivelAcessoUnidade'
  ) then
    create type public."NivelAcessoUnidade" as enum ('MEMBER', 'MANAGER');
  end if;
end;
$$;

create table if not exists public."UserUnitAccess" (
  "userId" text not null,
  "unidadeId" text not null,
  "nivel" public."NivelAcessoUnidade" not null default 'MEMBER',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  "deletedAt" timestamp(3),
  constraint "UserUnitAccess_pkey" primary key ("userId", "unidadeId"),
  constraint "UserUnitAccess_userId_fkey"
    foreign key ("userId") references public."User"(id)
    on delete restrict on update cascade,
  constraint "UserUnitAccess_unidadeId_fkey"
    foreign key ("unidadeId") references public."Unidade"(id)
    on delete restrict on update cascade
);

drop trigger if exists "UserUnitAccess_set_updatedAt" on public."UserUnitAccess";
create trigger "UserUnitAccess_set_updatedAt"
before update on public."UserUnitAccess"
for each row execute function private.set_updated_at();

-- Preserve current membership semantics, while allowing multi-unit access.
insert into public."UserUnitAccess" ("userId", "unidadeId", "nivel")
select crm_user.id, crm_user."unidadeId", 'MEMBER'::public."NivelAcessoUnidade"
from public."User" as crm_user
join public."Unidade" as unidade on unidade.id = crm_user."unidadeId"
where crm_user."unidadeId" is not null
  and crm_user."deletedAt" is null
  and unidade."deletedAt" is null
on conflict ("userId", "unidadeId") do nothing;

insert into public."UserUnitAccess" ("userId", "unidadeId", "nivel")
select unidade."responsavelId", unidade.id, 'MANAGER'::public."NivelAcessoUnidade"
from public."Unidade" as unidade
join public."User" as crm_user on crm_user.id = unidade."responsavelId"
where unidade."deletedAt" is null
  and crm_user."deletedAt" is null
on conflict ("userId", "unidadeId") do update
set "nivel" = 'MANAGER'::public."NivelAcessoUnidade",
    "deletedAt" = null;

-- Indexes used by foreign-key joins, dashboards and RLS predicates.
create index if not exists "User_gestorId_active_idx"
  on public."User" ("gestorId") where "deletedAt" is null;
create index if not exists "User_unidadeId_active_idx"
  on public."User" ("unidadeId") where "deletedAt" is null;
create index if not exists "User_role_active_idx"
  on public."User" (role) where "deletedAt" is null;

create index if not exists "Unidade_responsavelId_active_idx"
  on public."Unidade" ("responsavelId") where "deletedAt" is null;

create index if not exists "Cliente_unidadeId_active_idx"
  on public."Cliente" ("unidadeId") where "deletedAt" is null;
create index if not exists "Cliente_vendedorId_active_idx"
  on public."Cliente" ("vendedorId") where "deletedAt" is null;
create index if not exists "Cliente_status_fase_active_idx"
  on public."Cliente" (status, "faseFunil") where "deletedAt" is null;
create index if not exists "Cliente_vencimento_active_idx"
  on public."Cliente" ("dataVencimentoContrato")
  where "deletedAt" is null and "dataVencimentoContrato" is not null;

create index if not exists "Financeiro_clienteId_active_idx"
  on public."Financeiro" ("clienteId") where "deletedAt" is null;
create index if not exists "Financeiro_competencia_active_idx"
  on public."Financeiro" ("dataCompetencia" desc) where "deletedAt" is null;
create index if not exists "Financeiro_status_tipo_active_idx"
  on public."Financeiro" ("statusPagamento", tipo)
  where "deletedAt" is null;

create index if not exists "Documento_clienteId_active_idx"
  on public."Documento" ("clienteId") where "deletedAt" is null;
create index if not exists "Documento_propostaId_active_idx"
  on public."Documento" ("propostaId")
  where "deletedAt" is null and "propostaId" is not null;
create index if not exists "Documento_urlCaminho_active_idx"
  on public."Documento" ("urlCaminho") where "deletedAt" is null;

create index if not exists "Interacao_cliente_data_active_idx"
  on public."Interacao" ("clienteId", "dataInteracao" desc)
  where "deletedAt" is null;
create index if not exists "Interacao_responsavelId_active_idx"
  on public."Interacao" ("responsavelId") where "deletedAt" is null;

create index if not exists "Proposta_clienteId_active_idx"
  on public."Proposta" ("clienteId") where "deletedAt" is null;
create index if not exists "Proposta_vendedor_status_data_active_idx"
  on public."Proposta" ("vendedorId", status, "createdAt" desc)
  where "deletedAt" is null;

create index if not exists "Avaliacao_colaborador_mes_active_idx"
  on public."AvaliacaoDesempenho" ("colaboradorId", "mesReferencia" desc)
  where "deletedAt" is null;
create index if not exists "Avaliacao_avaliador_active_idx"
  on public."AvaliacaoDesempenho" ("avaliadorId")
  where "deletedAt" is null;

create index if not exists "Snapshot_unidade_mes_active_idx"
  on public."SnapshotUnidade" ("unidadeId", "mesReferencia" desc)
  where "deletedAt" is null;

create index if not exists "Analise_cliente_mes_active_idx"
  on public."AnaliseCliente" ("clienteId", "mesReferencia" desc)
  where "deletedAt" is null;

create index if not exists "Cancelamento_cliente_data_active_idx"
  on public."Cancelamento" ("clienteId", "dataCancelamento" desc)
  where "deletedAt" is null;

create index if not exists "UserUnitAccess_unidade_active_idx"
  on public."UserUnitAccess" ("unidadeId", "nivel", "userId")
  where "deletedAt" is null;
