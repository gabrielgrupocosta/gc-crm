-- Run manually after import-auth-users.ts --apply.
-- This verification reports only aggregate counts and never exposes PII.

do $$
declare
  v_active_users integer;
  v_linked_users integer;
  v_missing_auth_users integer;
  v_duplicate_auth_links integer;
begin
  select count(*)
    into v_active_users
  from public."User"
  where "deletedAt" is null;

  select count(*)
    into v_linked_users
  from public."User"
  where "deletedAt" is null
    and "authUserId" is not null;

  select count(*)
    into v_missing_auth_users
  from public."User" as crm_user
  left join auth.users as auth_user on auth_user.id = crm_user."authUserId"
  where crm_user."deletedAt" is null
    and (crm_user."authUserId" is null or auth_user.id is null);

  select count(*)
    into v_duplicate_auth_links
  from (
    select "authUserId"
    from public."User"
    where "authUserId" is not null
    group by "authUserId"
    having count(*) > 1
  ) as duplicate_links;

  if v_active_users <> 10 then
    raise exception 'Expected 10 active CRM users, found %.', v_active_users;
  end if;

  if v_linked_users <> v_active_users or v_missing_auth_users <> 0 then
    raise exception
      'Auth link verification failed. active=%, linked=%, missing=%.',
      v_active_users, v_linked_users, v_missing_auth_users;
  end if;

  if v_duplicate_auth_links <> 0 then
    raise exception 'Duplicate Auth links detected: %.', v_duplicate_auth_links;
  end if;

  raise notice
    'Auth link verification passed. active=%, linked=%, missing=0, duplicates=0.',
    v_active_users, v_linked_users;
end;
$$;

