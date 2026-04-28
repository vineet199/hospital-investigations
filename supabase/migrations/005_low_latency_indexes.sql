-- Low-latency indexes and helper RPCs for common app screens.

create index if not exists patients_tenant_name_lower_idx on public.patients (tenant_id, lower(name));
create index if not exists patients_tenant_phone_idx on public.patients (tenant_id, phone);
create index if not exists investigations_tenant_department_status_idx on public.investigations (tenant_id, department_id, status, created_at desc);
create index if not exists investigations_tenant_status_created_idx on public.investigations (tenant_id, status, created_at desc);
create index if not exists timeline_events_tenant_timestamp_idx on public.timeline_events (tenant_id, timestamp desc);
create index if not exists invoices_tenant_patient_status_idx on public.invoices (tenant_id, patient_id, payment_status, created_at desc);
create index if not exists medicine_batches_tenant_medicine_expiry_idx on public.medicine_batches (tenant_id, medicine_id, expiry_date);

create or replace function public.get_dashboard_summary(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
begin
  v_membership := public.require_membership(p_tenant_id);
  return jsonb_build_object(
    'activeInvestigations', (select count(*) from public.investigations where tenant_id = p_tenant_id and status <> 'Reviewed by Doctor'),
    'statPending', (select count(*) from public.investigations where tenant_id = p_tenant_id and priority = 'Stat' and status <> 'Reviewed by Doctor'),
    'resultsAwaitingReview', (select count(*) from public.investigations where tenant_id = p_tenant_id and status = 'Result Ready'),
    'totalTracked', (select count(*) from public.investigations where tenant_id = p_tenant_id),
    'recentActivity', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select e.investigation_id, e.stage, e.timestamp, e.actor, i.patient_id, i.type, i.department_id
        from public.timeline_events e
        join public.investigations i on i.tenant_id = e.tenant_id and i.id = e.investigation_id
        where e.tenant_id = p_tenant_id
        order by e.timestamp desc
        limit 20
      ) x
    )
  );
end;
$$;

create or replace function public.get_department_queue(p_tenant_id uuid, p_department_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
begin
  v_membership := public.require_membership(p_tenant_id);
  return (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select i.*, p.name as patient_name, p.ward, p.bed
      from public.investigations i
      join public.patients p on p.tenant_id = i.tenant_id and p.id = i.patient_id
      where i.tenant_id = p_tenant_id
        and i.department_id = p_department_id
        and i.status in ('Sent to Department', 'In Progress', 'Result Ready')
      order by case i.priority when 'Stat' then 0 when 'Urgent' then 1 else 2 end, i.created_at desc
      limit 100
    ) x
  );
end;
$$;

revoke all on function public.get_dashboard_summary(uuid) from public;
revoke all on function public.get_department_queue(uuid, text) from public;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
grant execute on function public.get_department_queue(uuid, text) to authenticated;
