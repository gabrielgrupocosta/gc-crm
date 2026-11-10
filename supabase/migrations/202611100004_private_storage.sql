-- GC CRM - private document bucket and authenticated access policies.
-- Existing object paths are preserved:
--   clientes/{clienteId}/{uuid.ext}
--   contratos/{propostaId}/{uuid.ext}

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do update
set public = false,
    file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit);

drop policy if exists "crm_documentos_select" on storage.objects;
create policy "crm_documentos_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and exists (
    select 1
    from public."Documento" as documento
    where documento."urlCaminho" = storage.objects.name
      and documento."deletedAt" is null
      and (
        (select private.current_role()) in ('ADMIN', 'FINANCEIRO')
        or (
          (select private.can_access_client(documento."clienteId"))
          and (
            (select private.has_permission('vendas', 'ler'))
            or (select private.has_permission('cs', 'ler'))
          )
        )
      )
  )
);

-- Direct authenticated uploads remain possible for the future Next.js client.
-- The planned crm-api function can alternatively create signed upload URLs
-- with the secret key, which bypasses this policy after doing the same checks.
drop policy if exists "crm_documentos_insert" on storage.objects;
create policy "crm_documentos_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and owner_id = (select auth.uid()::text)
  and (
    (
      (storage.foldername(name))[1] = 'clientes'
      and (select private.can_access_client((storage.foldername(name))[2]))
      and (
        (select private.has_permission('vendas', 'criar'))
        or (select private.has_permission('cs', 'criar'))
      )
    )
    or (
      (storage.foldername(name))[1] = 'contratos'
      and (select private.can_access_proposta((storage.foldername(name))[2]))
      and (
        (select private.has_permission('vendas', 'criar'))
        or (select private.has_permission('vendas', 'editar'))
      )
    )
  )
);

-- No authenticated UPDATE or DELETE policy is intentionally created. Files
-- are immutable, and deletion is a privileged retention/audit operation.
