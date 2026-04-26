-- Multi-tenant Supabase schema for the Hospital Investigation System.
-- Apply in the Supabase SQL editor or with the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  primary key (tenant_id, id)
);

create table if not exists public.doctors (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  department text not null,
  primary key (tenant_id, id)
);

create table if not exists public.patients (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  mrn text,
  name text not null,
  age integer not null check (age >= 0),
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  ward text not null,
  bed text not null,
  primary key (tenant_id, id),
  unique (tenant_id, mrn)
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('Admin', 'Doctor', 'Nurse', 'Technician', 'Department Head', 'Billing', 'Reception')),
  department_id text,
  doctor_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, email),
  unique (tenant_id, user_id),
  foreign key (tenant_id, department_id) references public.departments (tenant_id, id),
  foreign key (tenant_id, doctor_id) references public.doctors (tenant_id, id)
);

create table if not exists public.investigations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  patient_id text not null,
  ordered_by_doctor_id text not null,
  type text not null,
  notes text not null default '',
  priority text not null check (priority in ('Routine', 'Urgent', 'Stat')),
  department_id text not null,
  technician text,
  status text not null check (status in ('Ordered', 'Sent to Department', 'In Progress', 'Result Ready', 'Reviewed by Doctor')),
  result_notes text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id),
  foreign key (tenant_id, ordered_by_doctor_id) references public.doctors (tenant_id, id),
  foreign key (tenant_id, department_id) references public.departments (tenant_id, id)
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  investigation_id text not null,
  stage text not null check (stage in ('Ordered', 'Sent to Department', 'In Progress', 'Result Ready', 'Reviewed by Doctor')),
  timestamp timestamptz not null default now(),
  actor text not null,
  foreign key (tenant_id, investigation_id) references public.investigations (tenant_id, id) on delete cascade
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  user_name text not null,
  role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  timestamp timestamptz not null default now(),
  details_json jsonb not null default '{}'::jsonb
);

create index if not exists tenant_memberships_user_idx on public.tenant_memberships (user_id);
create index if not exists investigations_tenant_status_idx on public.investigations (tenant_id, status);
create index if not exists investigations_tenant_patient_idx on public.investigations (tenant_id, patient_id);
create index if not exists timeline_events_tenant_investigation_idx on public.timeline_events (tenant_id, investigation_id, timestamp);
create index if not exists audit_events_tenant_timestamp_idx on public.audit_events (tenant_id, timestamp desc);

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.require_membership(p_tenant_id uuid)
returns public.tenant_memberships
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
begin
  select * into v_membership
  from public.tenant_memberships m
  where m.tenant_id = p_tenant_id
    and m.user_id = auth.uid();

  if not found then
    raise exception 'You are not a member of this hospital.' using errcode = '42501';
  end if;

  return v_membership;
end;
$$;

create or replace function public.claim_membership_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if lower(coalesce(v_jwt_email, '')) <> lower(coalesce(p_email, '')) then
    raise exception 'You can only claim memberships for your authenticated email.' using errcode = '42501';
  end if;

  update public.tenant_memberships m
  set user_id = auth.uid()
  where lower(m.email) = lower(p_email)
    and (m.user_id is null or m.user_id = auth.uid());
end;
$$;

create or replace function public.link_demo_memberships()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenant_memberships m
  set user_id = u.id
  from auth.users u
  where lower(u.email) = lower(m.email)
    and (m.user_id is null or m.user_id = u.id);
end;
$$;

create or replace function public.pick_technician(p_department_id text)
returns text
language plpgsql
volatile
as $$
declare
  v_pool text[];
begin
  v_pool := case p_department_id
    when 'DEP-1' then array['Tech R. Khan', 'Tech M. Rivera']
    when 'DEP-2' then array['Tech E. Davis', 'Tech S. Park']
    when 'DEP-3' then array['Tech A. Smith', 'Tech G. Wilson', 'Tech D. Brown']
    when 'DEP-4' then array['Tech B. Jones', 'Tech F. Miller']
    when 'DEP-5' then array['Tech L. Nguyen', 'Tech O. Adeyemi']
    when 'DEP-6' then array['Tech C. Williams', 'Tech H. Kapoor']
    else array['Tech On Duty']
  end;

  return v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
end;
$$;

create or replace function public.write_audit(
  p_tenant_id uuid,
  p_user_id uuid,
  p_user_name text,
  p_role text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (tenant_id, user_id, user_name, role, action, entity_type, entity_id, details_json)
  values (p_tenant_id, p_user_id, p_user_name, p_role, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.create_investigations(p_tenant_id uuid, p_investigations jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
  v_item jsonb;
  v_index integer := 0;
  v_id text;
  v_patient_id text;
  v_doctor_id text;
  v_department_id text;
  v_type text;
  v_priority text;
  v_notes text;
  v_now timestamptz := now();
begin
  v_membership := public.require_membership(p_tenant_id);
  if v_membership.role not in ('Admin', 'Doctor') then
    raise exception 'Only doctors and admins can create investigation orders.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_investigations) <> 'array' or jsonb_array_length(p_investigations) = 0 then
    raise exception 'At least one investigation is required.';
  end if;

  for v_item in select * from jsonb_array_elements(p_investigations) loop
    v_index := v_index + 1;
    v_patient_id := v_item ->> 'patientId';
    v_department_id := v_item ->> 'departmentId';
    v_type := nullif(v_item ->> 'type', '');
    v_priority := coalesce(nullif(v_item ->> 'priority', ''), 'Routine');
    v_notes := coalesce(v_item ->> 'notes', '');
    v_doctor_id := coalesce(nullif(v_item ->> 'orderedByDoctorId', ''), v_membership.doctor_id);

    if v_membership.role = 'Doctor' then
      v_doctor_id := v_membership.doctor_id;
    end if;

    if v_doctor_id is null then
      select d.id into v_doctor_id from public.doctors d where d.tenant_id = p_tenant_id order by d.name limit 1;
    end if;

    if v_type is null then raise exception 'Investigation type is required.'; end if;
    if v_priority not in ('Routine', 'Urgent', 'Stat') then raise exception 'Invalid priority.'; end if;
    if not exists (select 1 from public.patients p where p.tenant_id = p_tenant_id and p.id = v_patient_id) then
      raise exception 'Patient does not belong to this hospital.';
    end if;
    if not exists (select 1 from public.departments d where d.tenant_id = p_tenant_id and d.id = v_department_id) then
      raise exception 'Department does not belong to this hospital.';
    end if;
    if not exists (select 1 from public.doctors d where d.tenant_id = p_tenant_id and d.id = v_doctor_id) then
      raise exception 'Ordering doctor does not belong to this hospital.';
    end if;

    v_id := 'INV-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint || '-' || v_index || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

    insert into public.investigations (
      tenant_id, id, patient_id, ordered_by_doctor_id, type, notes, priority, department_id, technician, status, result_notes, created_at
    ) values (
      p_tenant_id, v_id, v_patient_id, v_doctor_id, v_type, v_notes, v_priority, v_department_id, null, 'Ordered', null, v_now
    );

    insert into public.timeline_events (tenant_id, investigation_id, stage, timestamp, actor)
    values (p_tenant_id, v_id, 'Ordered', v_now, v_membership.display_name);
  end loop;

  perform public.write_audit(
    p_tenant_id, v_membership.user_id, v_membership.display_name, v_membership.role,
    'create_investigations', 'investigation', 'bulk', jsonb_build_object('count', jsonb_array_length(p_investigations))
  );
end;
$$;

create or replace function public.send_to_department(p_tenant_id uuid, p_investigation_id text, p_technician text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
  v_inv public.investigations%rowtype;
  v_now timestamptz := now();
  v_technician text;
begin
  v_membership := public.require_membership(p_tenant_id);
  if v_membership.role not in ('Admin', 'Doctor', 'Nurse') then
    raise exception 'Only doctors, nurses, and admins can dispatch investigations.' using errcode = '42501';
  end if;

  select * into v_inv from public.investigations i where i.tenant_id = p_tenant_id and i.id = p_investigation_id for update;
  if not found then raise exception 'Investigation not found.'; end if;
  if v_inv.status <> 'Ordered' then raise exception 'Only ordered investigations can be sent to a department.'; end if;

  v_technician := coalesce(nullif(p_technician, ''), public.pick_technician(v_inv.department_id));

  update public.investigations
  set status = 'Sent to Department', technician = v_technician
  where tenant_id = p_tenant_id and id = p_investigation_id;

  insert into public.timeline_events (tenant_id, investigation_id, stage, timestamp, actor)
  values (p_tenant_id, p_investigation_id, 'Sent to Department', v_now, v_membership.display_name);

  perform public.write_audit(
    p_tenant_id, v_membership.user_id, v_membership.display_name, v_membership.role,
    'send_to_department', 'investigation', p_investigation_id, jsonb_build_object('technician', v_technician)
  );
end;
$$;

create or replace function public.advance_investigation(p_tenant_id uuid, p_investigation_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
  v_inv public.investigations%rowtype;
  v_now timestamptz := now();
begin
  v_membership := public.require_membership(p_tenant_id);
  select * into v_inv from public.investigations i where i.tenant_id = p_tenant_id and i.id = p_investigation_id for update;
  if not found then raise exception 'Investigation not found.'; end if;

  if not (v_membership.role = 'Admin' or (v_membership.role in ('Technician', 'Department Head') and v_membership.department_id = v_inv.department_id)) then
    raise exception 'You can only update work for your assigned department.' using errcode = '42501';
  end if;
  if p_status not in ('In Progress', 'Result Ready') then raise exception 'Invalid status transition.'; end if;
  if p_status = 'In Progress' and v_inv.status <> 'Sent to Department' then raise exception 'Only queued investigations can be started.'; end if;
  if p_status = 'Result Ready' and v_inv.status not in ('Sent to Department', 'In Progress') then raise exception 'Only active investigations can be marked result-ready.'; end if;

  update public.investigations
  set status = p_status, technician = coalesce(technician, public.pick_technician(v_inv.department_id))
  where tenant_id = p_tenant_id and id = p_investigation_id;

  insert into public.timeline_events (tenant_id, investigation_id, stage, timestamp, actor)
  values (p_tenant_id, p_investigation_id, p_status, v_now, v_membership.display_name);

  perform public.write_audit(
    p_tenant_id, v_membership.user_id, v_membership.display_name, v_membership.role,
    'advance_status', 'investigation', p_investigation_id, jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function public.save_result(p_tenant_id uuid, p_investigation_id text, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
  v_inv public.investigations%rowtype;
  v_now timestamptz := now();
  v_notes text := trim(coalesce(p_notes, ''));
begin
  v_membership := public.require_membership(p_tenant_id);
  select * into v_inv from public.investigations i where i.tenant_id = p_tenant_id and i.id = p_investigation_id for update;
  if not found then raise exception 'Investigation not found.'; end if;
  if not (v_membership.role = 'Admin' or (v_membership.role in ('Technician', 'Department Head') and v_membership.department_id = v_inv.department_id)) then
    raise exception 'You can only save results for your assigned department.' using errcode = '42501';
  end if;
  if v_notes = '' then raise exception 'Result notes are required.'; end if;

  update public.investigations
  set result_notes = v_notes, status = 'Result Ready', technician = coalesce(technician, public.pick_technician(v_inv.department_id))
  where tenant_id = p_tenant_id and id = p_investigation_id;

  if v_inv.status <> 'Result Ready' then
    insert into public.timeline_events (tenant_id, investigation_id, stage, timestamp, actor)
    values (p_tenant_id, p_investigation_id, 'Result Ready', v_now, v_membership.display_name);
  end if;

  perform public.write_audit(p_tenant_id, v_membership.user_id, v_membership.display_name, v_membership.role, 'save_result', 'investigation', p_investigation_id, '{}'::jsonb);
end;
$$;

create or replace function public.mark_reviewed(p_tenant_id uuid, p_investigation_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.tenant_memberships%rowtype;
  v_inv public.investigations%rowtype;
  v_now timestamptz := now();
begin
  v_membership := public.require_membership(p_tenant_id);
  if v_membership.role not in ('Admin', 'Doctor') then
    raise exception 'Only doctors and admins can review results.' using errcode = '42501';
  end if;
  select * into v_inv from public.investigations i where i.tenant_id = p_tenant_id and i.id = p_investigation_id for update;
  if not found then raise exception 'Investigation not found.'; end if;
  if v_inv.status <> 'Result Ready' then raise exception 'Only result-ready investigations can be reviewed.'; end if;

  update public.investigations set status = 'Reviewed by Doctor' where tenant_id = p_tenant_id and id = p_investigation_id;
  insert into public.timeline_events (tenant_id, investigation_id, stage, timestamp, actor)
  values (p_tenant_id, p_investigation_id, 'Reviewed by Doctor', v_now, v_membership.display_name);

  perform public.write_audit(p_tenant_id, v_membership.user_id, v_membership.display_name, v_membership.role, 'mark_reviewed', 'investigation', p_investigation_id, '{}'::jsonb);
end;
$$;

alter table public.tenants enable row level security;
alter table public.departments enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.investigations enable row level security;
alter table public.timeline_events enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "members can read tenants" on public.tenants;
create policy "members can read tenants" on public.tenants for select to authenticated using (public.is_tenant_member(id));
drop policy if exists "members can read departments" on public.departments;
create policy "members can read departments" on public.departments for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "members can read doctors" on public.doctors;
create policy "members can read doctors" on public.doctors for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "members can read patients" on public.patients;
create policy "members can read patients" on public.patients for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "users can read own memberships" on public.tenant_memberships;
create policy "users can read own memberships" on public.tenant_memberships for select to authenticated using (user_id = auth.uid());
drop policy if exists "members can read investigations" on public.investigations;
create policy "members can read investigations" on public.investigations for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "members can read timeline events" on public.timeline_events;
create policy "members can read timeline events" on public.timeline_events for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "members can read audit events" on public.audit_events;
create policy "members can read audit events" on public.audit_events for select to authenticated using (public.is_tenant_member(tenant_id));

grant usage on schema public to anon, authenticated;
grant select on public.tenants, public.departments, public.doctors, public.patients, public.tenant_memberships, public.investigations, public.timeline_events, public.audit_events to authenticated;

-- Supabase/Postgres grants EXECUTE on functions to PUBLIC by default. Revoke first,
-- then grant only the functions that browser-authenticated users should call.
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.claim_membership_by_email(text) from public;
revoke all on function public.create_investigations(uuid, jsonb) from public;
revoke all on function public.send_to_department(uuid, text, text) from public;
revoke all on function public.advance_investigation(uuid, text, text) from public;
revoke all on function public.save_result(uuid, text, text) from public;
revoke all on function public.mark_reviewed(uuid, text) from public;
revoke all on function public.link_demo_memberships() from public;

grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.claim_membership_by_email(text) to authenticated;
grant execute on function public.create_investigations(uuid, jsonb) to authenticated;
grant execute on function public.send_to_department(uuid, text, text) to authenticated;
grant execute on function public.advance_investigation(uuid, text, text) to authenticated;
grant execute on function public.save_result(uuid, text, text) to authenticated;
grant execute on function public.mark_reviewed(uuid, text) to authenticated;
grant execute on function public.link_demo_memberships() to service_role;

revoke all on function public.require_membership(uuid) from public;
revoke all on function public.write_audit(uuid, uuid, text, text, text, text, text, jsonb) from public;
revoke all on function public.pick_technician(text) from public;

insert into public.tenants (id, slug, name) values
  ('00000000-0000-0000-0000-000000000001', 'city-general', 'City General Hospital'),
  ('00000000-0000-0000-0000-000000000002', 'sunrise-medical', 'Sunrise Medical Center')
on conflict (slug) do update set name = excluded.name;

insert into public.departments (tenant_id, id, name) values
  ('00000000-0000-0000-0000-000000000001', 'DEP-1', 'Pharmacy'),
  ('00000000-0000-0000-0000-000000000001', 'DEP-2', 'X-Ray Lab'),
  ('00000000-0000-0000-0000-000000000001', 'DEP-3', 'Pathology Lab'),
  ('00000000-0000-0000-0000-000000000001', 'DEP-4', 'Radiology'),
  ('00000000-0000-0000-0000-000000000001', 'DEP-5', 'Blood Bank'),
  ('00000000-0000-0000-0000-000000000001', 'DEP-6', 'Cardiology'),
  ('00000000-0000-0000-0000-000000000002', 'DEP-1', 'Pharmacy'),
  ('00000000-0000-0000-0000-000000000002', 'DEP-2', 'Diagnostics'),
  ('00000000-0000-0000-0000-000000000002', 'DEP-3', 'Pathology Lab'),
  ('00000000-0000-0000-0000-000000000002', 'DEP-4', 'Imaging Center'),
  ('00000000-0000-0000-0000-000000000002', 'DEP-6', 'Cardiology')
on conflict (tenant_id, id) do update set name = excluded.name;

insert into public.doctors (tenant_id, id, name, department) values
  ('00000000-0000-0000-0000-000000000001', 'D-101', 'Dr. Sarah Chen', 'Internal Medicine'),
  ('00000000-0000-0000-0000-000000000001', 'D-102', 'Dr. James Wilson', 'Cardiology'),
  ('00000000-0000-0000-0000-000000000001', 'D-103', 'Dr. Priya Patel', 'General Surgery'),
  ('00000000-0000-0000-0000-000000000002', 'D-201', 'Dr. Anika Rao', 'Internal Medicine'),
  ('00000000-0000-0000-0000-000000000002', 'D-202', 'Dr. Victor Mensah', 'Emergency Medicine')
on conflict (tenant_id, id) do update set name = excluded.name, department = excluded.department;

insert into public.patients (tenant_id, id, mrn, name, age, gender, ward, bed) values
  ('00000000-0000-0000-0000-000000000001', 'P-1042', 'MRN-0001042', 'Robert Miller', 64, 'Male', 'Ward 3B', 'Bed 12'),
  ('00000000-0000-0000-0000-000000000001', 'P-1043', 'MRN-0001043', 'Aisha Sharma', 42, 'Female', 'Ward 2A', 'Bed 04'),
  ('00000000-0000-0000-0000-000000000001', 'P-1044', 'MRN-0001044', 'Marcus Johnson', 28, 'Male', 'ER', 'Bed 01'),
  ('00000000-0000-0000-0000-000000000001', 'P-1045', 'MRN-0001045', 'Eleanor Davis', 82, 'Female', 'ICU', 'Bed 08'),
  ('00000000-0000-0000-0000-000000000001', 'P-1046', 'MRN-0001046', 'David Kim', 55, 'Male', 'Ward 4C', 'Bed 22'),
  ('00000000-0000-0000-0000-000000000002', 'P-2042', 'SUN-0002042', 'Meera Iyer', 37, 'Female', 'Ward 1A', 'Bed 03'),
  ('00000000-0000-0000-0000-000000000002', 'P-2043', 'SUN-0002043', 'Noah Alvarez', 49, 'Male', 'ER', 'Bed 02'),
  ('00000000-0000-0000-0000-000000000002', 'P-2044', 'SUN-0002044', 'Fatima Hassan', 71, 'Female', 'ICU', 'Bed 05')
on conflict (tenant_id, id) do update set mrn = excluded.mrn, name = excluded.name, age = excluded.age, gender = excluded.gender, ward = excluded.ward, bed = excluded.bed;

insert into public.tenant_memberships (tenant_id, email, display_name, role, department_id, doctor_id) values
  ('00000000-0000-0000-0000-000000000001', 'doctor@city-general.demo', 'Dr. Sarah Chen', 'Doctor', null, 'D-101'),
  ('00000000-0000-0000-0000-000000000001', 'nurse@city-general.demo', 'Nurse Maria Gomez', 'Nurse', null, null),
  ('00000000-0000-0000-0000-000000000001', 'lab@city-general.demo', 'Pathology Technician', 'Technician', 'DEP-3', null),
  ('00000000-0000-0000-0000-000000000001', 'radiology@city-general.demo', 'Radiology Technician', 'Technician', 'DEP-4', null),
  ('00000000-0000-0000-0000-000000000001', 'admin@city-general.demo', 'City General Admin', 'Admin', null, null),
  ('00000000-0000-0000-0000-000000000002', 'doctor@sunrise.demo', 'Dr. Anika Rao', 'Doctor', null, 'D-201'),
  ('00000000-0000-0000-0000-000000000002', 'nurse@sunrise.demo', 'Nurse Omar Ali', 'Nurse', null, null),
  ('00000000-0000-0000-0000-000000000002', 'lab@sunrise.demo', 'Sunrise Lab Technician', 'Technician', 'DEP-3', null),
  ('00000000-0000-0000-0000-000000000002', 'admin@sunrise.demo', 'Sunrise Admin', 'Admin', null, null)
on conflict (tenant_id, email) do update set display_name = excluded.display_name, role = excluded.role, department_id = excluded.department_id, doctor_id = excluded.doctor_id;

insert into public.investigations (tenant_id, id, patient_id, ordered_by_doctor_id, type, notes, priority, department_id, technician, status, result_notes, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'P-1042', 'D-101', 'Lipid Panel', 'Routine check, fasting 12h', 'Routine', 'DEP-3', 'Tech A. Smith', 'Reviewed by Doctor', 'LDL elevated at 160 mg/dL. HDL 45 mg/dL. Triglycerides 150 mg/dL.', now() - interval '24 hours'),
  ('00000000-0000-0000-0000-000000000001', 'INV-CG-002', 'P-1044', 'D-103', 'CT Scan', 'Rule out appendicitis', 'Stat', 'DEP-4', 'Tech B. Jones', 'Result Ready', 'No evidence of acute appendicitis. Mild thickening of terminal ileum.', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'INV-CG-003', 'P-1045', 'D-102', 'ECG', 'Patient reporting chest pain', 'Stat', 'DEP-6', 'Tech C. Williams', 'In Progress', null, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000001', 'INV-CG-004', 'P-1043', 'D-101', 'Urine Culture', 'Suspected UTI', 'Routine', 'DEP-3', null, 'Sent to Department', null, now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000002', 'INV-SM-001', 'P-2042', 'D-201', 'Blood Test', 'CBC and thyroid panel', 'Routine', 'DEP-3', 'Tech G. Wilson', 'Result Ready', 'CBC within normal limits. TSH mildly elevated.', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-000000000002', 'INV-SM-002', 'P-2043', 'D-202', 'X-Ray', 'Chest pain after fall', 'Urgent', 'DEP-4', 'Tech B. Jones', 'In Progress', null, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000002', 'INV-SM-003', 'P-2044', 'D-201', 'ECG', 'Irregular rhythm', 'Stat', 'DEP-6', null, 'Ordered', null, now() - interval '20 minutes')
on conflict (tenant_id, id) do update set patient_id = excluded.patient_id, ordered_by_doctor_id = excluded.ordered_by_doctor_id, type = excluded.type, notes = excluded.notes, priority = excluded.priority, department_id = excluded.department_id, technician = excluded.technician, status = excluded.status, result_notes = excluded.result_notes, created_at = excluded.created_at;

insert into public.timeline_events (id, tenant_id, investigation_id, stage, timestamp, actor) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'Ordered', now() - interval '24 hours', 'Dr. Sarah Chen'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'Sent to Department', now() - interval '23 hours 45 minutes', 'Dr. Sarah Chen'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'In Progress', now() - interval '22 hours', 'Tech A. Smith'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'Result Ready', now() - interval '20 hours', 'Tech A. Smith'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'INV-CG-001', 'Reviewed by Doctor', now() - interval '2 hours', 'Dr. Sarah Chen'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'INV-CG-002', 'Ordered', now() - interval '3 hours', 'Dr. Priya Patel'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'INV-CG-002', 'Sent to Department', now() - interval '2 hours 55 minutes', 'Dr. Priya Patel'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'INV-CG-002', 'In Progress', now() - interval '2 hours 40 minutes', 'Tech B. Jones'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'INV-CG-002', 'Result Ready', now() - interval '15 minutes', 'Tech B. Jones'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'INV-CG-003', 'Ordered', now() - interval '1 hour', 'Dr. James Wilson'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'INV-CG-003', 'Sent to Department', now() - interval '50 minutes', 'Dr. James Wilson'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'INV-CG-003', 'In Progress', now() - interval '20 minutes', 'Tech C. Williams'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'INV-CG-004', 'Ordered', now() - interval '5 hours', 'Dr. Sarah Chen'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'INV-CG-004', 'Sent to Department', now() - interval '4 hours 30 minutes', 'Dr. Sarah Chen'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'INV-SM-001', 'Ordered', now() - interval '6 hours', 'Dr. Anika Rao'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'INV-SM-001', 'Sent to Department', now() - interval '5 hours 45 minutes', 'Dr. Anika Rao'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'INV-SM-001', 'In Progress', now() - interval '5 hours', 'Tech G. Wilson'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'INV-SM-001', 'Result Ready', now() - interval '1 hour', 'Tech G. Wilson'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'INV-SM-002', 'Ordered', now() - interval '2 hours', 'Dr. Victor Mensah'),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'INV-SM-002', 'Sent to Department', now() - interval '1 hour 45 minutes', 'Dr. Victor Mensah'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'INV-SM-002', 'In Progress', now() - interval '1 hour', 'Tech B. Jones'),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', 'INV-SM-003', 'Ordered', now() - interval '20 minutes', 'Dr. Anika Rao')
on conflict (id) do update set tenant_id = excluded.tenant_id, investigation_id = excluded.investigation_id, stage = excluded.stage, timestamp = excluded.timestamp, actor = excluded.actor;
