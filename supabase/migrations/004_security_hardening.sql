-- Security hardening helpers for production deployments.

create table if not exists public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  approved_by uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_access_grants enable row level security;

drop policy if exists "platform admins can read support grants" on public.support_access_grants;
create policy "platform admins can read support grants" on public.support_access_grants
  for select to authenticated
  using (public.is_platform_admin() or public.is_tenant_member(tenant_id));

create or replace function public.has_active_support_access(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_access_grants g
    where g.tenant_id = p_tenant_id
      and g.platform_user_id = auth.uid()
      and g.starts_at <= now()
      and g.expires_at > now()
      and g.revoked_at is null
  );
$$;

create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit events are append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_audit_event_mutation();

revoke all on function public.has_active_support_access(uuid) from public;
grant execute on function public.has_active_support_access(uuid) to authenticated;
grant select on public.support_access_grants to authenticated;
