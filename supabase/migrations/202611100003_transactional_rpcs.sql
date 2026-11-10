-- GC CRM - transactional business operations.
--
-- These RPCs keep multi-table operations atomic and prevent browser clients
-- from writing protected columns such as deletedAt and notaOperador directly.

create or replace function public.crm_register_cancellation(
  p_cliente_id text,
  p_motivo text,
  p_receita_perdida numeric,
  p_tentativas_retencao text default null,
  p_data_cancelamento timestamp without time zone default current_timestamp
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
begin
  if (select private.current_profile_id()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado.';
  end if;

  if trim(coalesce(p_motivo, '')) = '' then
    raise exception using errcode = '22023', message = 'Motivo obrigatorio.';
  end if;

  if p_receita_perdida is null or p_receita_perdida <= 0 then
    raise exception using errcode = '22023', message = 'Receita perdida deve ser positiva.';
  end if;

  if not (select private.has_permission('cs', 'criar'))
     or not (select private.can_access_client(p_cliente_id)) then
    raise exception using errcode = '42501', message = 'Sem permissao para cancelar este cliente.';
  end if;

  perform 1
  from public."Cliente" as cliente
  where cliente.id = p_cliente_id
    and cliente."deletedAt" is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Cliente nao encontrado.';
  end if;

  insert into public."Cancelamento" (
    "clienteId",
    motivo,
    "tentativasRetencao",
    "receitaPerdida",
    "dataCancelamento"
  ) values (
    p_cliente_id,
    trim(p_motivo),
    nullif(trim(coalesce(p_tentativas_retencao, '')), ''),
    p_receita_perdida,
    coalesce(p_data_cancelamento, current_timestamp)
  )
  returning * into v_result;

  update public."Cliente"
  set status = 'CANCELADO'::public."StatusCliente"
  where id = p_cliente_id
    and "deletedAt" is null;

  return to_jsonb(v_result);
end;
$$;

create or replace function public.crm_score_operator(
  p_cliente_id text,
  p_nota_operador integer,
  p_mes_referencia date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio_mes timestamp without time zone;
  v_fim_mes timestamp without time zone;
  v_analise_id text;
  v_result record;
begin
  if (select private.current_profile_id()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado.';
  end if;

  if (select private.current_role()) not in ('ADMIN', 'GESTOR_PL')
     or not (select private.has_permission('cs', 'editar'))
     or not (select private.can_access_client(p_cliente_id)) then
    raise exception using errcode = '42501', message = 'Sem permissao para pontuar este cliente.';
  end if;

  if p_nota_operador is null or p_nota_operador < 1 or p_nota_operador > 5 then
    raise exception using errcode = '22023', message = 'Nota do operador deve estar entre 1 e 5.';
  end if;

  perform 1
  from public."Cliente" as cliente
  where cliente.id = p_cliente_id
    and cliente."deletedAt" is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Cliente nao encontrado.';
  end if;

  v_inicio_mes := date_trunc('month', coalesce(p_mes_referencia, current_date))::timestamp;
  v_fim_mes := (v_inicio_mes + interval '1 month');

  -- Prevent concurrent requests from creating two analyses for the same month
  -- without imposing a unique index that could fail on unknown legacy data.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_cliente_id || ':' || v_inicio_mes::text, 0)
  );

  select analise.id
    into v_analise_id
  from public."AnaliseCliente" as analise
  where analise."clienteId" = p_cliente_id
    and analise."mesReferencia" >= v_inicio_mes
    and analise."mesReferencia" < v_fim_mes
    and analise."deletedAt" is null
  order by analise."createdAt" desc
  limit 1
  for update;

  if v_analise_id is null then
    insert into public."AnaliseCliente" (
      "clienteId",
      "mesReferencia",
      classificacao,
      "notaOperador"
    ) values (
      p_cliente_id,
      v_inicio_mes,
      'SAUDAVEL'::public."ClassificacaoSaude",
      p_nota_operador
    )
    returning * into v_result;
  else
    update public."AnaliseCliente"
    set "notaOperador" = p_nota_operador
    where id = v_analise_id
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

create or replace function public.crm_soft_delete(
  p_entity text,
  p_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := lower(trim(coalesce(p_entity, '')));
  v_affected integer := 0;
begin
  if (select private.current_profile_id()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado.';
  end if;

  if p_id is null or trim(p_id) = '' then
    raise exception using errcode = '22023', message = 'Identificador obrigatorio.';
  end if;

  if v_entity = 'cliente' then
    if not (select private.has_permission('vendas', 'excluir'))
       or not (select private.can_access_client(p_id)) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Cliente"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'financeiro' then
    if not (select private.has_permission('financeiro', 'excluir'))
       or not exists (
         select 1
         from public."Financeiro" as financeiro
         where financeiro.id = p_id
           and financeiro."deletedAt" is null
           and (
             (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
             or (select private.can_access_client(financeiro."clienteId"))
           )
       ) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Financeiro"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'documento' then
    if not exists (
      select 1
      from public."Documento" as documento
      where documento.id = p_id
        and documento."deletedAt" is null
        and (select private.can_access_client(documento."clienteId"))
        and (
          (select private.has_permission('vendas', 'excluir'))
          or (select private.has_permission('cs', 'excluir'))
        )
    ) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    -- The object is intentionally retained in the private bucket for audit.
    update public."Documento"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'interacao' then
    if not (select private.has_permission('vendas', 'excluir'))
       or not exists (
         select 1
         from public."Interacao" as interacao
         where interacao.id = p_id
           and interacao."deletedAt" is null
           and (select private.can_access_client(interacao."clienteId"))
       ) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Interacao"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'proposta' then
    if not (select private.has_permission('vendas', 'excluir'))
       or not (select private.can_access_proposta(p_id)) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Proposta"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'avaliacao' then
    if not (select private.has_permission('rh', 'excluir'))
       or not exists (
         select 1
         from public."AvaliacaoDesempenho" as avaliacao
         where avaliacao.id = p_id
           and avaliacao."deletedAt" is null
           and (select private.can_manage_user(avaliacao."colaboradorId"))
       ) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."AvaliacaoDesempenho"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'analise_cliente' then
    if not (select private.has_permission('cs', 'excluir'))
       or not exists (
         select 1
         from public."AnaliseCliente" as analise
         where analise.id = p_id
           and analise."deletedAt" is null
           and (select private.can_access_client(analise."clienteId"))
       ) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."AnaliseCliente"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'cancelamento' then
    if not (select private.is_admin()) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Cancelamento"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  elsif v_entity = 'unidade' then
    if not (select private.is_admin()) then
      raise exception using errcode = '42501', message = 'Sem permissao.';
    end if;

    update public."Unidade"
    set "deletedAt" = current_timestamp
    where id = p_id and "deletedAt" is null;

  else
    raise exception using errcode = '22023', message = 'Entidade nao suportada.';
  end if;

  get diagnostics v_affected = row_count;
  return v_affected = 1;
end;
$$;

revoke all on function public.crm_register_cancellation(text, text, numeric, text, timestamp without time zone)
  from public, anon;
revoke all on function public.crm_score_operator(text, integer, date)
  from public, anon;
revoke all on function public.crm_soft_delete(text, text)
  from public, anon;

grant execute on function public.crm_register_cancellation(text, text, numeric, text, timestamp without time zone)
  to authenticated;
grant execute on function public.crm_score_operator(text, integer, date)
  to authenticated;
grant execute on function public.crm_soft_delete(text, text)
  to authenticated;

