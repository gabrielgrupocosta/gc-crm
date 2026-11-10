-- GC CRM - Supabase Auth helpers, grants and row-level security.
--
-- The legacy Prisma connection continues to use the database owner and is not
-- subject to these client-role policies. Browser traffic uses authenticated
-- and receives only the grants below. The anon role receives no table access.

create or replace function private.current_profile_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select crm_user.id
  from public."User" as crm_user
  where crm_user."authUserId" = (select auth.uid())
    and crm_user."deletedAt" is null
  limit 1
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select crm_user.role::text
  from public."User" as crm_user
  where crm_user.id = (select private.current_profile_id())
  limit 1
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_role()) = 'ADMIN', false)
$$;

create or replace function private.role_default_permission(
  p_role text,
  p_module text,
  p_action text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'ADMIN' then true

    when p_role = 'FINANCEIRO' then
      (p_module = 'dashboard' and p_action = 'ler')
      or (p_module = 'financeiro' and p_action in ('ler', 'criar', 'editar', 'excluir'))
      or (p_module = 'vendas' and p_action in ('ler', 'editar'))
      or (p_module = 'unidades' and p_action = 'ler')

    when p_role = 'GESTOR_PL' then
      (p_module = 'dashboard' and p_action = 'ler')
      or (p_module in ('vendas', 'cs', 'rh') and p_action in ('ler', 'criar', 'editar', 'excluir'))
      or (p_module = 'financeiro' and p_action in ('ler', 'criar', 'editar', 'excluir'))
      or (p_module = 'unidades' and p_action = 'ler')

    when p_role = 'VENDEDOR' then
      (p_module = 'dashboard' and p_action = 'ler')
      or (p_module = 'vendas' and p_action in ('ler', 'criar', 'editar'))
      or (p_module = 'rh' and p_action = 'ler')

    when p_role = 'SDR_CLOSER' then
      (p_module = 'dashboard' and p_action = 'ler')
      or (p_module = 'vendas' and p_action in ('ler', 'criar', 'editar'))
      or (p_module = 'rh' and p_action = 'ler')

    when p_role = 'COLABORADOR' then
      (p_module = 'dashboard' and p_action = 'ler')

    else false
  end
$$;

create or replace function private.has_permission(
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_override text;
begin
  select crm_user.role::text,
         crm_user.permissoes #>> array[p_module, p_action]
    into v_role, v_override
  from public."User" as crm_user
  where crm_user.id = (select private.current_profile_id())
    and crm_user."deletedAt" is null;

  if v_role is null then
    return false;
  end if;

  if v_role = 'ADMIN' then
    return true;
  end if;

  if lower(coalesce(v_override, '')) = 'true' then
    return true;
  elsif lower(coalesce(v_override, '')) = 'false' then
    return false;
  end if;

  return private.role_default_permission(v_role, p_module, p_action);
end;
$$;

create or replace function private.can_access_unit(p_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.is_admin())
    or exists (
      select 1
      from public."UserUnitAccess" as access
      where access."userId" = (select private.current_profile_id())
        and access."unidadeId" = p_unidade_id
        and access."deletedAt" is null
    ),
    false
  )
$$;

create or replace function private.can_access_client(p_cliente_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id text := private.current_profile_id();
  v_role text := private.current_role();
  v_unidade_id text;
  v_vendedor_id text;
  v_status text;
begin
  if v_profile_id is null then
    return false;
  end if;

  if v_role = 'ADMIN' then
    return true;
  end if;

  select cliente."unidadeId", cliente."vendedorId", cliente.status::text
    into v_unidade_id, v_vendedor_id, v_status
  from public."Cliente" as cliente
  where cliente.id = p_cliente_id
    and cliente."deletedAt" is null;

  if v_unidade_id is null then
    return false;
  end if;

  if v_role = 'VENDEDOR' then
    return v_vendedor_id = v_profile_id;
  elsif v_role = 'SDR_CLOSER' then
    return v_status = 'PROSPECCAO'
      and private.can_access_unit(v_unidade_id);
  end if;

  return private.can_access_unit(v_unidade_id);
end;
$$;

create or replace function private.can_manage_user(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.is_admin())
    or (
      (select private.current_role()) = 'GESTOR_PL'
      and exists (
        select 1
        from public."User" as target_user
        where target_user.id = p_user_id
          and target_user."deletedAt" is null
          and (
            target_user."gestorId" = (select private.current_profile_id())
            or (
              target_user."unidadeId" is not null
              and exists (
                select 1
                from public."UserUnitAccess" as access
                where access."userId" = (select private.current_profile_id())
                  and access."unidadeId" = target_user."unidadeId"
                  and access.nivel = 'MANAGER'::public."NivelAcessoUnidade"
                  and access."deletedAt" is null
              )
            )
          )
      )
    ),
    false
  )
$$;

create or replace function private.can_access_proposta(p_proposta_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.is_admin())
    or (select private.current_role()) = 'FINANCEIRO'
    or exists (
      select 1
      from public."Proposta" as proposta
      where proposta.id = p_proposta_id
        and proposta."deletedAt" is null
        and (
          proposta."vendedorId" = (select private.current_profile_id())
          or private.can_access_client(proposta."clienteId")
        )
    ),
    false
  )
$$;

revoke all on function private.current_profile_id() from public, anon;
revoke all on function private.current_role() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.role_default_permission(text, text, text) from public, anon, authenticated;
revoke all on function private.has_permission(text, text) from public, anon;
revoke all on function private.can_access_unit(text) from public, anon;
revoke all on function private.can_access_client(text) from public, anon;
revoke all on function private.can_manage_user(text) from public, anon;
revoke all on function private.can_access_proposta(text) from public, anon;

grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_permission(text, text) to authenticated;
grant execute on function private.can_access_unit(text) to authenticated;
grant execute on function private.can_access_client(text) to authenticated;
grant execute on function private.can_manage_user(text) to authenticated;
grant execute on function private.can_access_proposta(text) to authenticated;

-- Safe self-profile endpoint. It avoids granting browser access to User.senha
-- or User.authUserId while still returning the dynamic permission matrix.
create or replace function public.crm_current_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', crm_user.id,
    'nome', crm_user.nome,
    'email', crm_user.email,
    'role', crm_user.role,
    'tipoVendedor', crm_user."tipoVendedor",
    'metas', crm_user.metas,
    'gestorId', crm_user."gestorId",
    'unidadeId', crm_user."unidadeId",
    'permissoes', coalesce(crm_user.permissoes, '{}'::jsonb)
  )
  from public."User" as crm_user
  where crm_user.id = (select private.current_profile_id())
    and crm_user."deletedAt" is null
$$;

revoke all on function public.crm_current_profile() from public, anon;
grant execute on function public.crm_current_profile() to authenticated;

-- No table is available to anonymous browser traffic.
revoke all on table public."User" from anon, authenticated;
revoke all on table public."Unidade" from anon, authenticated;
revoke all on table public."Cliente" from anon, authenticated;
revoke all on table public."Financeiro" from anon, authenticated;
revoke all on table public."Documento" from anon, authenticated;
revoke all on table public."Interacao" from anon, authenticated;
revoke all on table public."Proposta" from anon, authenticated;
revoke all on table public."AvaliacaoDesempenho" from anon, authenticated;
revoke all on table public."SnapshotUnidade" from anon, authenticated;
revoke all on table public."AnaliseCliente" from anon, authenticated;
revoke all on table public."Cancelamento" from anon, authenticated;
revoke all on table public."UserUnitAccess" from anon, authenticated;

-- User is a safe directory only. Sensitive/self-only fields come from the RPC.
grant select (
  id, nome, role, "tipoVendedor", "gestorId", "unidadeId",
  "createdAt", "updatedAt", "deletedAt"
) on table public."User" to authenticated;

grant select on table public."Unidade" to authenticated;
grant insert (nome, cnpj, endereco, "responsavelId") on table public."Unidade" to authenticated;
grant update (nome, cnpj, endereco, "responsavelId") on table public."Unidade" to authenticated;

grant select on table public."Cliente" to authenticated;
grant insert (
  "razaoSocial", "nomeFantasia", "cnpjCpf", email, telefone, status,
  "faseFunil", "dataEntrada", "dataVencimentoContrato", "unidadeId", "vendedorId"
) on table public."Cliente" to authenticated;
grant update (
  "razaoSocial", "nomeFantasia", "cnpjCpf", email, telefone, status,
  "faseFunil", "dataEntrada", "dataVencimentoContrato", "unidadeId", "vendedorId"
) on table public."Cliente" to authenticated;

grant select on table public."Financeiro" to authenticated;
grant insert (
  tipo, "categoriaServico", descricao, valor, "dataCompetencia",
  "statusPagamento", "clienteId"
) on table public."Financeiro" to authenticated;
grant update (
  tipo, "categoriaServico", descricao, valor, "dataCompetencia", "statusPagamento"
) on table public."Financeiro" to authenticated;

grant select on table public."Documento" to authenticated;
grant insert ("nomeArquivo", "urlCaminho", "tipoArquivo", "clienteId", "propostaId")
  on table public."Documento" to authenticated;
grant update ("nomeArquivo") on table public."Documento" to authenticated;

grant select on table public."Interacao" to authenticated;
grant insert (tipo, "dataInteracao", descricao, "clienteId", "responsavelId")
  on table public."Interacao" to authenticated;

grant select on table public."Proposta" to authenticated;
grant insert ("clienteId", "vendedorId", status, valor, descricao, "dataEnvio", "dataAssinatura")
  on table public."Proposta" to authenticated;
grant update (status, valor, descricao, "dataEnvio", "dataAssinatura")
  on table public."Proposta" to authenticated;

grant select on table public."AvaliacaoDesempenho" to authenticated;
grant insert (
  "colaboradorId", "avaliadorId", "mesReferencia", notas, feedback,
  "notaGeral", "feedbackTexto"
) on table public."AvaliacaoDesempenho" to authenticated;
grant update ("mesReferencia", notas, feedback, "notaGeral", "feedbackTexto")
  on table public."AvaliacaoDesempenho" to authenticated;

grant select on table public."SnapshotUnidade" to authenticated;
grant insert ("unidadeId", "mesReferencia", faturamento, mrr, "churnRate")
  on table public."SnapshotUnidade" to authenticated;
grant update ("mesReferencia", faturamento, mrr, "churnRate")
  on table public."SnapshotUnidade" to authenticated;

grant select on table public."AnaliseCliente" to authenticated;
grant insert (
  "clienteId", "mesReferencia", "notaCSAT", riscos, "planoAcao", classificacao
) on table public."AnaliseCliente" to authenticated;
grant update ("mesReferencia", "notaCSAT", riscos, "planoAcao", classificacao)
  on table public."AnaliseCliente" to authenticated;

grant select on table public."Cancelamento" to authenticated;
grant select on table public."UserUnitAccess" to authenticated;

alter table public."User" enable row level security;
alter table public."Unidade" enable row level security;
alter table public."Cliente" enable row level security;
alter table public."Financeiro" enable row level security;
alter table public."Documento" enable row level security;
alter table public."Interacao" enable row level security;
alter table public."Proposta" enable row level security;
alter table public."AvaliacaoDesempenho" enable row level security;
alter table public."SnapshotUnidade" enable row level security;
alter table public."AnaliseCliente" enable row level security;
alter table public."Cancelamento" enable row level security;
alter table public."UserUnitAccess" enable row level security;

drop policy if exists "crm_user_select" on public."User";
create policy "crm_user_select"
on public."User" for select to authenticated
using (
  "deletedAt" is null
  and (select private.current_profile_id()) is not null
  and (
    id = (select private.current_profile_id())
    or (select private.is_admin())
    or (select private.current_role()) = 'FINANCEIRO'
    or (select private.can_manage_user(id))
    or ("unidadeId" is not null and (select private.can_access_unit("unidadeId")))
  )
);

drop policy if exists "crm_user_unit_access_select" on public."UserUnitAccess";
create policy "crm_user_unit_access_select"
on public."UserUnitAccess" for select to authenticated
using (
  "deletedAt" is null
  and (
    "userId" = (select private.current_profile_id())
    or (select private.is_admin())
    or (
      (select private.current_role()) = 'GESTOR_PL'
      and (select private.can_access_unit("unidadeId"))
    )
  )
);

drop policy if exists "crm_unidade_select" on public."Unidade";
create policy "crm_unidade_select"
on public."Unidade" for select to authenticated
using (
  "deletedAt" is null
  and (
    (select private.is_admin())
    or (select private.current_role()) = 'FINANCEIRO'
    or (select private.can_access_unit(id))
  )
);

drop policy if exists "crm_unidade_insert" on public."Unidade";
create policy "crm_unidade_insert"
on public."Unidade" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.is_admin())
);

drop policy if exists "crm_unidade_update" on public."Unidade";
create policy "crm_unidade_update"
on public."Unidade" for update to authenticated
using ("deletedAt" is null and (select private.is_admin()))
with check ("deletedAt" is null and (select private.is_admin()));

drop policy if exists "crm_cliente_select" on public."Cliente";
create policy "crm_cliente_select"
on public."Cliente" for select to authenticated
using (
  "deletedAt" is null
  and (
    ((select private.current_role()) = 'FINANCEIRO'
      and (select private.has_permission('financeiro', 'ler')))
    or (
      (select private.can_access_client(id))
      and (
        (select private.has_permission('vendas', 'ler'))
        or (select private.has_permission('cs', 'ler'))
        or (select private.has_permission('financeiro', 'ler'))
      )
    )
  )
);

drop policy if exists "crm_cliente_insert" on public."Cliente";
create policy "crm_cliente_insert"
on public."Cliente" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'criar'))
  and (
    (select private.is_admin())
    or (
      (select private.current_role()) in ('GESTOR_PL', 'COLABORADOR')
      and (select private.can_access_unit("unidadeId"))
    )
    or (
      (select private.current_role()) = 'VENDEDOR'
      and "vendedorId" = (select private.current_profile_id())
      and (select private.can_access_unit("unidadeId"))
    )
    or (
      (select private.current_role()) = 'SDR_CLOSER'
      and status = 'PROSPECCAO'
      and (select private.can_access_unit("unidadeId"))
    )
  )
);

drop policy if exists "crm_cliente_update" on public."Cliente";
create policy "crm_cliente_update"
on public."Cliente" for update to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'editar'))
  and (select private.can_access_client(id))
)
with check (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'editar'))
  and (
    (select private.is_admin())
    or (
      (select private.current_role()) in ('GESTOR_PL', 'COLABORADOR')
      and (select private.can_access_unit("unidadeId"))
    )
    or (
      (select private.current_role()) = 'VENDEDOR'
      and "vendedorId" = (select private.current_profile_id())
      and (select private.can_access_unit("unidadeId"))
    )
    or (
      (select private.current_role()) = 'SDR_CLOSER'
      and status = 'PROSPECCAO'
      and (select private.can_access_unit("unidadeId"))
    )
  )
);

drop policy if exists "crm_financeiro_select" on public."Financeiro";
create policy "crm_financeiro_select"
on public."Financeiro" for select to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('financeiro', 'ler'))
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (select private.can_access_client("clienteId"))
  )
);

drop policy if exists "crm_financeiro_insert" on public."Financeiro";
create policy "crm_financeiro_insert"
on public."Financeiro" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('financeiro', 'criar'))
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (select private.can_access_client("clienteId"))
  )
);

drop policy if exists "crm_financeiro_update" on public."Financeiro";
create policy "crm_financeiro_update"
on public."Financeiro" for update to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('financeiro', 'editar'))
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (select private.can_access_client("clienteId"))
  )
)
with check (
  "deletedAt" is null
  and (select private.has_permission('financeiro', 'editar'))
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (select private.can_access_client("clienteId"))
  )
);

drop policy if exists "crm_documento_select" on public."Documento";
create policy "crm_documento_select"
on public."Documento" for select to authenticated
using (
  "deletedAt" is null
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (
      (select private.can_access_client("clienteId"))
      and (
        (select private.has_permission('vendas', 'ler'))
        or (select private.has_permission('cs', 'ler'))
      )
    )
  )
);

drop policy if exists "crm_documento_insert" on public."Documento";
create policy "crm_documento_insert"
on public."Documento" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.can_access_client("clienteId"))
  and (
    (select private.has_permission('vendas', 'criar'))
    or (select private.has_permission('cs', 'criar'))
  )
);

drop policy if exists "crm_documento_update" on public."Documento";
create policy "crm_documento_update"
on public."Documento" for update to authenticated
using (
  "deletedAt" is null
  and (select private.can_access_client("clienteId"))
  and (
    (select private.has_permission('vendas', 'editar'))
    or (select private.has_permission('cs', 'editar'))
  )
)
with check (
  "deletedAt" is null
  and (select private.can_access_client("clienteId"))
);

drop policy if exists "crm_interacao_select" on public."Interacao";
create policy "crm_interacao_select"
on public."Interacao" for select to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'ler'))
  and (select private.can_access_client("clienteId"))
);

drop policy if exists "crm_interacao_insert" on public."Interacao";
create policy "crm_interacao_insert"
on public."Interacao" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'criar'))
  and (select private.can_access_client("clienteId"))
  and (
    "responsavelId" = (select private.current_profile_id())
    or (select private.is_admin())
  )
);

drop policy if exists "crm_proposta_select" on public."Proposta";
create policy "crm_proposta_select"
on public."Proposta" for select to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'ler'))
  and (select private.can_access_proposta(id))
);

drop policy if exists "crm_proposta_insert" on public."Proposta";
create policy "crm_proposta_insert"
on public."Proposta" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'criar'))
  and (
    (select private.is_admin())
    or (
      (select private.current_role()) in ('VENDEDOR', 'SDR_CLOSER')
      and "vendedorId" = (select private.current_profile_id())
      and (select private.can_access_client("clienteId"))
    )
    or (
      (select private.current_role()) in ('GESTOR_PL', 'COLABORADOR')
      and (select private.can_access_client("clienteId"))
    )
  )
);

drop policy if exists "crm_proposta_update" on public."Proposta";
create policy "crm_proposta_update"
on public."Proposta" for update to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'editar'))
  and (select private.can_access_proposta(id))
)
with check (
  "deletedAt" is null
  and (select private.has_permission('vendas', 'editar'))
  and (select private.can_access_proposta(id))
);

drop policy if exists "crm_avaliacao_select" on public."AvaliacaoDesempenho";
create policy "crm_avaliacao_select"
on public."AvaliacaoDesempenho" for select to authenticated
using (
  "deletedAt" is null
  and (
    "colaboradorId" = (select private.current_profile_id())
    or (select private.is_admin())
    or (
      (select private.has_permission('rh', 'ler'))
      and (select private.can_manage_user("colaboradorId"))
    )
  )
);

drop policy if exists "crm_avaliacao_insert" on public."AvaliacaoDesempenho";
create policy "crm_avaliacao_insert"
on public."AvaliacaoDesempenho" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('rh', 'criar'))
  and (select private.current_role()) in ('ADMIN', 'GESTOR_PL')
  and "avaliadorId" = (select private.current_profile_id())
  and (select private.can_manage_user("colaboradorId"))
);

drop policy if exists "crm_avaliacao_update" on public."AvaliacaoDesempenho";
create policy "crm_avaliacao_update"
on public."AvaliacaoDesempenho" for update to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('rh', 'editar'))
  and (
    (select private.is_admin())
    or "avaliadorId" = (select private.current_profile_id())
  )
  and (select private.can_manage_user("colaboradorId"))
)
with check (
  "deletedAt" is null
  and (select private.can_manage_user("colaboradorId"))
);

drop policy if exists "crm_snapshot_select" on public."SnapshotUnidade";
create policy "crm_snapshot_select"
on public."SnapshotUnidade" for select to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('dashboard', 'ler'))
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (select private.can_access_unit("unidadeId"))
  )
);

drop policy if exists "crm_snapshot_insert" on public."SnapshotUnidade";
create policy "crm_snapshot_insert"
on public."SnapshotUnidade" for insert to authenticated
with check ("deletedAt" is null and (select private.is_admin()));

drop policy if exists "crm_snapshot_update" on public."SnapshotUnidade";
create policy "crm_snapshot_update"
on public."SnapshotUnidade" for update to authenticated
using ("deletedAt" is null and (select private.is_admin()))
with check ("deletedAt" is null and (select private.is_admin()));

drop policy if exists "crm_analise_select" on public."AnaliseCliente";
create policy "crm_analise_select"
on public."AnaliseCliente" for select to authenticated
using (
  "deletedAt" is null
  and (
    (select private.is_admin())
    or (
      (select private.has_permission('cs', 'ler'))
      and (select private.can_access_client("clienteId"))
    )
    or exists (
      select 1
      from public."Cliente" as cliente
      where cliente.id = "AnaliseCliente"."clienteId"
        and cliente."deletedAt" is null
        and cliente."vendedorId" = (select private.current_profile_id())
    )
  )
);

drop policy if exists "crm_analise_insert" on public."AnaliseCliente";
create policy "crm_analise_insert"
on public."AnaliseCliente" for insert to authenticated
with check (
  "deletedAt" is null
  and (select private.has_permission('cs', 'criar'))
  and (select private.can_access_client("clienteId"))
);

drop policy if exists "crm_analise_update" on public."AnaliseCliente";
create policy "crm_analise_update"
on public."AnaliseCliente" for update to authenticated
using (
  "deletedAt" is null
  and (select private.has_permission('cs', 'editar'))
  and (select private.can_access_client("clienteId"))
)
with check (
  "deletedAt" is null
  and (select private.can_access_client("clienteId"))
);

drop policy if exists "crm_cancelamento_select" on public."Cancelamento";
create policy "crm_cancelamento_select"
on public."Cancelamento" for select to authenticated
using (
  "deletedAt" is null
  and (
    (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
    or (
      (select private.has_permission('cs', 'ler'))
      and (select private.can_access_client("clienteId"))
    )
  )
);

