-- SaaS onboarding, hospital operations, billing, reports, pharmacy, and commercial scaffolding.
-- This migration is additive and keeps the original investigation workflow intact.

create extension if not exists pgcrypto;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.tenant_memberships'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute 'alter table public.tenant_memberships drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.tenant_memberships
  add constraint tenant_memberships_role_check
  check (role in ('Platform Admin', 'Admin', 'Doctor', 'Nurse', 'Technician', 'Department Head', 'Pharmacist', 'Billing', 'Reception'));

alter table public.tenants add column if not exists status text not null default 'active';
alter table public.tenants add column if not exists plan_code text not null default 'trial';

alter table public.patients add column if not exists dob date;
alter table public.patients add column if not exists phone text;
alter table public.patients add column if not exists alternate_phone text;
alter table public.patients add column if not exists address text;
alter table public.patients add column if not exists guardian_name text;
alter table public.patients add column if not exists emergency_contact text;
alter table public.patients add column if not exists id_proof_type text;
alter table public.patients add column if not exists id_proof_number text;
alter table public.patients add column if not exists insurance_provider text;
alter table public.patients add column if not exists corporate_name text;
alter table public.patients add column if not exists patient_class text not null default 'IPD';
alter table public.patients add column if not exists active boolean not null default true;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  code text primary key,
  name text not null,
  monthly_price numeric(12,2) not null default 0,
  user_limit integer,
  patient_limit integer,
  investigation_limit integer,
  storage_gb integer,
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  legal_name text,
  address text,
  phone text,
  email text,
  website text,
  gst_number text,
  license_number text,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  report_footer text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_branding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#0f766e',
  secondary_color text not null default '#0f172a',
  report_header text,
  report_footer text,
  subdomain text,
  custom_domain text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_modules (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default true,
  configured_at timestamptz not null default now(),
  primary key (tenant_id, module_code)
);

create table if not exists public.tenant_subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz not null default now(),
  current_period_ends_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_start date not null,
  active_users integer not null default 0,
  patients_registered integer not null default 0,
  investigations_ordered integer not null default 0,
  reports_generated integer not null default 0,
  invoices_generated integer not null default 0,
  pharmacy_transactions integer not null default 0,
  storage_mb integer not null default 0,
  primary key (tenant_id, period_start)
);

create table if not exists public.wards (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  floor text,
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.beds (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  ward_id text not null,
  label text not null,
  status text not null default 'available',
  active boolean not null default true,
  primary key (tenant_id, id),
  foreign key (tenant_id, ward_id) references public.wards(tenant_id, id)
);

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null,
  department_id text,
  doctor_id text,
  status text not null default 'pending',
  invited_by uuid,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.doctor_profiles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id text not null,
  email text,
  phone text,
  specialty text,
  qualification text,
  registration_number text,
  signature_url text,
  stamp_url text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, doctor_id),
  foreign key (tenant_id, doctor_id) references public.doctors(tenant_id, id)
);

create table if not exists public.admissions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  patient_id text not null,
  patient_class text not null default 'IPD',
  ward_id text,
  bed_id text,
  status text not null default 'admitted',
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  notes text,
  primary key (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients(tenant_id, id),
  foreign key (tenant_id, ward_id) references public.wards(tenant_id, id),
  foreign key (tenant_id, bed_id) references public.beds(tenant_id, id)
);

create table if not exists public.sample_types (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  container text,
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.investigation_categories (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.investigation_catalog (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  code text,
  name text not null,
  category_id text,
  department_id text not null,
  sample_type_id text,
  fasting_required boolean not null default false,
  instructions text,
  turnaround_hours integer not null default 24,
  price numeric(12,2) not null default 0,
  reference_range text,
  report_template text,
  active boolean not null default true,
  primary key (tenant_id, id),
  foreign key (tenant_id, department_id) references public.departments(tenant_id, id),
  foreign key (tenant_id, category_id) references public.investigation_categories(tenant_id, id),
  foreign key (tenant_id, sample_type_id) references public.sample_types(tenant_id, id)
);

create table if not exists public.invoices (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  patient_id text not null,
  status text not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid',
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients(tenant_id, id)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id text not null,
  description text not null,
  investigation_id text,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  foreign key (tenant_id, invoice_id) references public.invoices(tenant_id, id) on delete cascade,
  foreign key (tenant_id, investigation_id) references public.investigations(tenant_id, id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id text not null,
  amount numeric(12,2) not null,
  method text not null,
  reference text,
  received_by uuid,
  received_at timestamptz not null default now(),
  foreign key (tenant_id, invoice_id) references public.invoices(tenant_id, id) on delete cascade
);

create table if not exists public.report_templates (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  report_type text not null,
  template_body text not null default '',
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.generated_reports (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  patient_id text not null,
  investigation_id text,
  report_type text not null,
  status text not null default 'draft',
  content text not null default '',
  qr_payload text,
  finalized_by uuid,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients(tenant_id, id),
  foreign key (tenant_id, investigation_id) references public.investigations(tenant_id, id)
);

create table if not exists public.pharmacy_stores (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  location text,
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.medicines (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  generic_name text not null,
  brand_name text,
  strength text,
  dosage_form text,
  manufacturer text,
  reorder_level integer not null default 0,
  active boolean not null default true,
  primary key (tenant_id, id)
);

create table if not exists public.medicine_batches (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  medicine_id text not null,
  store_id text not null,
  batch_number text not null,
  expiry_date date,
  quantity integer not null default 0,
  unit_cost numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  primary key (tenant_id, id),
  foreign key (tenant_id, medicine_id) references public.medicines(tenant_id, id),
  foreign key (tenant_id, store_id) references public.pharmacy_stores(tenant_id, id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id text not null,
  movement_type text not null,
  quantity integer not null,
  reason text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, batch_id) references public.medicine_batches(tenant_id, id)
);

create table if not exists public.prescriptions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  patient_id text not null,
  doctor_id text,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, patient_id) references public.patients(tenant_id, id),
  foreign key (tenant_id, doctor_id) references public.doctors(tenant_id, id)
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prescription_id text not null,
  medicine_id text not null,
  dose text,
  frequency text,
  duration text,
  quantity integer not null default 1,
  foreign key (tenant_id, prescription_id) references public.prescriptions(tenant_id, id),
  foreign key (tenant_id, medicine_id) references public.medicines(tenant_id, id)
);

create table if not exists public.dispensing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prescription_id text,
  batch_id text not null,
  quantity integer not null,
  dispensed_by uuid,
  dispensed_at timestamptz not null default now(),
  foreign key (tenant_id, prescription_id) references public.prescriptions(tenant_id, id),
  foreign key (tenant_id, batch_id) references public.medicine_batches(tenant_id, id)
);

create or replace function public.has_tenant_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins p where p.user_id = auth.uid())
     or exists (select 1 from public.tenant_memberships m where m.user_id = auth.uid() and m.role = 'Platform Admin');
$$;

create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_hospital(
  p_name text,
  p_slug text,
  p_admin_email text,
  p_admin_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_slug text := nullif(public.slugify(p_slug), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can create hospitals.' using errcode = '42501';
  end if;
  if v_slug is null then v_slug := public.slugify(p_name); end if;
  insert into public.tenants (slug, name, status, plan_code)
  values (v_slug, p_name, 'active', 'trial') returning id into v_tenant_id;
  insert into public.tenant_settings (tenant_id, legal_name, email) values (v_tenant_id, p_name, p_admin_email);
  insert into public.tenant_branding (tenant_id, report_header) values (v_tenant_id, p_name);
  insert into public.tenant_subscriptions (tenant_id, plan_code, status, trial_ends_at)
  values (v_tenant_id, 'trial', 'trialing', now() + interval '30 days');
  insert into public.tenant_modules (tenant_id, module_code, enabled) values
    (v_tenant_id, 'investigations', true), (v_tenant_id, 'billing', true),
    (v_tenant_id, 'pharmacy', true), (v_tenant_id, 'reports', true)
  on conflict do nothing;
  insert into public.departments (tenant_id, id, name) values
    (v_tenant_id, 'DEP-1', 'Pharmacy'), (v_tenant_id, 'DEP-2', 'Diagnostics'),
    (v_tenant_id, 'DEP-3', 'Pathology Lab'), (v_tenant_id, 'DEP-4', 'Radiology'),
    (v_tenant_id, 'DEP-5', 'Blood Bank'), (v_tenant_id, 'DEP-6', 'Cardiology')
  on conflict do nothing;
  insert into public.tenant_memberships (tenant_id, email, display_name, role)
  values (v_tenant_id, lower(p_admin_email), p_admin_name, 'Admin');
  return v_tenant_id;
end;
$$;

create or replace function public.upsert_tenant_settings(p_tenant_id uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Platform Admin']) then raise exception 'Admin access required.' using errcode='42501'; end if;
  insert into public.tenant_settings (tenant_id, legal_name, address, phone, email, website, gst_number, license_number, report_footer, updated_at)
  values (p_tenant_id, p_settings->>'legalName', p_settings->>'address', p_settings->>'phone', p_settings->>'email', p_settings->>'website', p_settings->>'gstNumber', p_settings->>'licenseNumber', p_settings->>'reportFooter', now())
  on conflict (tenant_id) do update set legal_name=excluded.legal_name, address=excluded.address, phone=excluded.phone, email=excluded.email, website=excluded.website, gst_number=excluded.gst_number, license_number=excluded.license_number, report_footer=excluded.report_footer, updated_at=now();
end; $$;

create or replace function public.invite_staff(p_tenant_id uuid, p_email text, p_name text, p_role text, p_department_id text default null, p_doctor_id text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Platform Admin']) then raise exception 'Admin access required.' using errcode='42501'; end if;
  insert into public.tenant_memberships (tenant_id, email, display_name, role, department_id, doctor_id)
  values (p_tenant_id, lower(p_email), p_name, p_role, nullif(p_department_id,''), nullif(p_doctor_id,''))
  on conflict (tenant_id, email) do update set display_name=excluded.display_name, role=excluded.role, department_id=excluded.department_id, doctor_id=excluded.doctor_id;
  insert into public.staff_invitations (tenant_id, email, display_name, role, department_id, doctor_id, invited_by)
  values (p_tenant_id, lower(p_email), p_name, p_role, nullif(p_department_id,''), nullif(p_doctor_id,''), auth.uid());
end; $$;

create or replace function public.register_patient(p_tenant_id uuid, p_patient jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text := coalesce(nullif(p_patient->>'id',''), 'P-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  v_mrn text := coalesce(nullif(p_patient->>'mrn',''), 'MRN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Reception','Nurse','Doctor','Platform Admin']) then raise exception 'Patient registration access required.' using errcode='42501'; end if;
  insert into public.patients (tenant_id,id,mrn,name,age,gender,ward,bed,dob,phone,alternate_phone,address,guardian_name,emergency_contact,id_proof_type,id_proof_number,insurance_provider,corporate_name,patient_class)
  values (p_tenant_id, v_id, v_mrn, p_patient->>'name', coalesce((p_patient->>'age')::int,0), coalesce(p_patient->>'gender','Other'), coalesce(p_patient->>'ward','OPD'), coalesce(p_patient->>'bed','-'), nullif(p_patient->>'dob','')::date, p_patient->>'phone', p_patient->>'alternatePhone', p_patient->>'address', p_patient->>'guardianName', p_patient->>'emergencyContact', p_patient->>'idProofType', p_patient->>'idProofNumber', p_patient->>'insuranceProvider', p_patient->>'corporateName', coalesce(p_patient->>'patientClass','OPD'))
  on conflict (tenant_id,id) do update set mrn=excluded.mrn,name=excluded.name,age=excluded.age,gender=excluded.gender,ward=excluded.ward,bed=excluded.bed,dob=excluded.dob,phone=excluded.phone,alternate_phone=excluded.alternate_phone,address=excluded.address,guardian_name=excluded.guardian_name,emergency_contact=excluded.emergency_contact,id_proof_type=excluded.id_proof_type,id_proof_number=excluded.id_proof_number,insurance_provider=excluded.insurance_provider,corporate_name=excluded.corporate_name,patient_class=excluded.patient_class;
  return v_id;
end; $$;

create or replace function public.upsert_catalog_item(p_tenant_id uuid, p_item jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text := coalesce(nullif(p_item->>'id',''), 'TEST-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  v_category_id text := coalesce(nullif(p_item->>'categoryId',''), 'CAT-GENERAL');
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Department Head','Platform Admin']) then raise exception 'Catalog admin access required.' using errcode='42501'; end if;
  insert into public.investigation_categories (tenant_id,id,name) values (p_tenant_id, v_category_id, coalesce(p_item->>'categoryName','General')) on conflict do nothing;
  insert into public.investigation_catalog (tenant_id,id,code,name,category_id,department_id,sample_type_id,fasting_required,instructions,turnaround_hours,price,reference_range,report_template,active)
  values (p_tenant_id, v_id, p_item->>'code', p_item->>'name', v_category_id, coalesce(p_item->>'departmentId','DEP-3'), nullif(p_item->>'sampleTypeId',''), coalesce((p_item->>'fastingRequired')::boolean,false), p_item->>'instructions', coalesce((p_item->>'turnaroundHours')::int,24), coalesce((p_item->>'price')::numeric,0), p_item->>'referenceRange', p_item->>'reportTemplate', coalesce((p_item->>'active')::boolean,true))
  on conflict (tenant_id,id) do update set code=excluded.code,name=excluded.name,category_id=excluded.category_id,department_id=excluded.department_id,sample_type_id=excluded.sample_type_id,fasting_required=excluded.fasting_required,instructions=excluded.instructions,turnaround_hours=excluded.turnaround_hours,price=excluded.price,reference_range=excluded.reference_range,report_template=excluded.report_template,active=excluded.active;
  return v_id;
end; $$;

create or replace function public.create_invoice_for_investigation(p_tenant_id uuid, p_investigation_id text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_inv public.investigations%rowtype;
  v_invoice_id text := 'INV-BILL-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_price numeric(12,2) := 0;
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Billing','Reception','Platform Admin']) then raise exception 'Billing access required.' using errcode='42501'; end if;
  select * into v_inv from public.investigations where tenant_id=p_tenant_id and id=p_investigation_id;
  if not found then raise exception 'Investigation not found.'; end if;
  select coalesce(price,0) into v_price from public.investigation_catalog where tenant_id=p_tenant_id and lower(name)=lower(v_inv.type) and active=true limit 1;
  v_price := coalesce(v_price,0);
  insert into public.invoices (tenant_id,id,patient_id,status,subtotal,total,created_by) values (p_tenant_id,v_invoice_id,v_inv.patient_id,'issued',v_price,v_price,auth.uid());
  insert into public.invoice_items (tenant_id,invoice_id,description,investigation_id,quantity,unit_price,total) values (p_tenant_id,v_invoice_id,v_inv.type,p_investigation_id,1,v_price,v_price);
  return v_invoice_id;
end; $$;

create or replace function public.upsert_medicine(p_tenant_id uuid, p_item jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_id text := coalesce(nullif(p_item->>'id',''), 'MED-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Pharmacist','Platform Admin']) then raise exception 'Pharmacy access required.' using errcode='42501'; end if;
  insert into public.medicines (tenant_id,id,generic_name,brand_name,strength,dosage_form,manufacturer,reorder_level,active)
  values (p_tenant_id,v_id,p_item->>'genericName',p_item->>'brandName',p_item->>'strength',p_item->>'dosageForm',p_item->>'manufacturer',coalesce((p_item->>'reorderLevel')::int,0),coalesce((p_item->>'active')::boolean,true))
  on conflict (tenant_id,id) do update set generic_name=excluded.generic_name,brand_name=excluded.brand_name,strength=excluded.strength,dosage_form=excluded.dosage_form,manufacturer=excluded.manufacturer,reorder_level=excluded.reorder_level,active=excluded.active;
  return v_id;
end; $$;

create or replace function public.adjust_stock(p_tenant_id uuid, p_batch jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_id text := coalesce(nullif(p_batch->>'id',''), 'BATCH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
begin
  if not public.has_tenant_role(p_tenant_id, array['Admin','Pharmacist','Platform Admin']) then raise exception 'Pharmacy access required.' using errcode='42501'; end if;
  insert into public.pharmacy_stores (tenant_id,id,name) values (p_tenant_id, coalesce(p_batch->>'storeId','STORE-MAIN'), 'Main Pharmacy') on conflict do nothing;
  insert into public.medicine_batches (tenant_id,id,medicine_id,store_id,batch_number,expiry_date,quantity,unit_cost,selling_price)
  values (p_tenant_id,v_id,p_batch->>'medicineId',coalesce(p_batch->>'storeId','STORE-MAIN'),coalesce(p_batch->>'batchNumber','DEFAULT'),nullif(p_batch->>'expiryDate','')::date,coalesce((p_batch->>'quantity')::int,0),coalesce((p_batch->>'unitCost')::numeric,0),coalesce((p_batch->>'sellingPrice')::numeric,0))
  on conflict (tenant_id,id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,selling_price=excluded.selling_price,expiry_date=excluded.expiry_date;
  insert into public.stock_movements (tenant_id,batch_id,movement_type,quantity,reason,actor_id) values (p_tenant_id,v_id,'adjustment',coalesce((p_batch->>'quantity')::int,0),p_batch->>'reason',auth.uid());
  return v_id;
end; $$;

-- RLS and read policies for new tenant-owned tables.
alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_branding enable row level security;
alter table public.tenant_modules enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.wards enable row level security;
alter table public.beds enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.doctor_profiles enable row level security;
alter table public.admissions enable row level security;
alter table public.sample_types enable row level security;
alter table public.investigation_categories enable row level security;
alter table public.investigation_catalog enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.report_templates enable row level security;
alter table public.generated_reports enable row level security;
alter table public.pharmacy_stores enable row level security;
alter table public.medicines enable row level security;
alter table public.medicine_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.dispensing_events enable row level security;

drop policy if exists "platform admins can read platform admins" on public.platform_admins;
create policy "platform admins can read platform admins" on public.platform_admins for select to authenticated using (public.is_platform_admin());
drop policy if exists "authenticated can read plans" on public.plans;
create policy "authenticated can read plans" on public.plans for select to authenticated using (true);

drop policy if exists "members can read tenants" on public.tenants;
drop policy if exists "members and platform admins can read tenants" on public.tenants;
create policy "members and platform admins can read tenants" on public.tenants
  for select to authenticated
  using (public.is_tenant_member(id) or public.is_platform_admin());

drop policy if exists "users can read own memberships" on public.tenant_memberships;
drop policy if exists "members can read tenant memberships" on public.tenant_memberships;
create policy "members can read tenant memberships" on public.tenant_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_member(tenant_id) or public.is_platform_admin());

do $$
declare t text;
begin
  foreach t in array array['tenant_settings','tenant_branding','tenant_modules','tenant_subscriptions','usage_counters','wards','beds','staff_invitations','doctor_profiles','admissions','sample_types','investigation_categories','investigation_catalog','invoices','invoice_items','payments','report_templates','generated_reports','pharmacy_stores','medicines','medicine_batches','stock_movements','prescriptions','prescription_items','dispensing_events'] loop
    execute format('drop policy if exists "members can read %I" on public.%I', t, t);
    execute format('create policy "members can read %I" on public.%I for select to authenticated using (public.is_tenant_member(tenant_id))', t, t);
  end loop;
end $$;

grant select on public.platform_admins, public.plans, public.tenant_settings, public.tenant_branding, public.tenant_modules, public.tenant_subscriptions, public.usage_counters, public.wards, public.beds, public.staff_invitations, public.doctor_profiles, public.admissions, public.sample_types, public.investigation_categories, public.investigation_catalog, public.invoices, public.invoice_items, public.payments, public.report_templates, public.generated_reports, public.pharmacy_stores, public.medicines, public.medicine_batches, public.stock_movements, public.prescriptions, public.prescription_items, public.dispensing_events to authenticated;

revoke all on function public.has_tenant_role(uuid, text[]) from public;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.create_hospital(text,text,text,text) from public;
revoke all on function public.upsert_tenant_settings(uuid,jsonb) from public;
revoke all on function public.invite_staff(uuid,text,text,text,text,text) from public;
revoke all on function public.register_patient(uuid,jsonb) from public;
revoke all on function public.upsert_catalog_item(uuid,jsonb) from public;
revoke all on function public.create_invoice_for_investigation(uuid,text) from public;
revoke all on function public.upsert_medicine(uuid,jsonb) from public;
revoke all on function public.adjust_stock(uuid,jsonb) from public;

grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.create_hospital(text,text,text,text) to authenticated;
grant execute on function public.upsert_tenant_settings(uuid,jsonb) to authenticated;
grant execute on function public.invite_staff(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.register_patient(uuid,jsonb) to authenticated;
grant execute on function public.upsert_catalog_item(uuid,jsonb) to authenticated;
grant execute on function public.create_invoice_for_investigation(uuid,text) to authenticated;
grant execute on function public.upsert_medicine(uuid,jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid,jsonb) to authenticated;

insert into public.plans (code,name,monthly_price,user_limit,patient_limit,investigation_limit,storage_gb,modules) values
  ('trial','Trial',0,10,500,1000,5,'["investigations","billing","reports"]'),
  ('basic','Basic',4999,25,5000,10000,20,'["investigations","billing","reports"]'),
  ('pro','Pro',14999,100,50000,100000,100,'["investigations","billing","reports","pharmacy"]'),
  ('enterprise','Enterprise',0,null,null,null,null,'["investigations","billing","reports","pharmacy","custom-domain","priority-support"]')
on conflict (code) do update set name=excluded.name, monthly_price=excluded.monthly_price, user_limit=excluded.user_limit, patient_limit=excluded.patient_limit, investigation_limit=excluded.investigation_limit, storage_gb=excluded.storage_gb, modules=excluded.modules;

insert into public.tenant_settings (tenant_id, legal_name) select id, name from public.tenants on conflict do nothing;
insert into public.tenant_branding (tenant_id, report_header) select id, name from public.tenants on conflict do nothing;
insert into public.tenant_subscriptions (tenant_id, plan_code, status, trial_ends_at) select id, plan_code, 'trialing', now() + interval '30 days' from public.tenants on conflict do nothing;
insert into public.tenant_modules (tenant_id,module_code,enabled) select id, 'investigations', true from public.tenants on conflict do nothing;
insert into public.tenant_modules (tenant_id,module_code,enabled) select id, 'billing', true from public.tenants on conflict do nothing;
insert into public.tenant_modules (tenant_id,module_code,enabled) select id, 'reports', true from public.tenants on conflict do nothing;
insert into public.tenant_modules (tenant_id,module_code,enabled) select id, 'pharmacy', true from public.tenants on conflict do nothing;

insert into public.platform_admins (user_id, email, display_name)
select id, lower(email), coalesce(raw_user_meta_data->>'name', 'HIMS SaaS Platform Admin')
from auth.users
where lower(email) = 'platform@hims-saas.demo'
on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name;

insert into public.tenant_memberships (tenant_id, email, display_name, role, department_id) values
  ('00000000-0000-0000-0000-000000000001', 'pharmacist@city-general.demo', 'City General Pharmacist', 'Pharmacist', 'DEP-1'),
  ('00000000-0000-0000-0000-000000000002', 'pharmacist@sunrise.demo', 'Sunrise Pharmacist', 'Pharmacist', 'DEP-1')
on conflict (tenant_id, email) do update set display_name = excluded.display_name, role = excluded.role, department_id = excluded.department_id;

insert into public.wards (tenant_id, id, name, floor) values
  ('00000000-0000-0000-0000-000000000001', 'WARD-3B', 'Ward 3B', '3'),
  ('00000000-0000-0000-0000-000000000001', 'WARD-2A', 'Ward 2A', '2'),
  ('00000000-0000-0000-0000-000000000001', 'ICU', 'ICU', '1'),
  ('00000000-0000-0000-0000-000000000001', 'ER', 'ER', 'Ground'),
  ('00000000-0000-0000-0000-000000000002', 'WARD-1A', 'Ward 1A', '1'),
  ('00000000-0000-0000-0000-000000000002', 'ICU', 'ICU', '1'),
  ('00000000-0000-0000-0000-000000000002', 'ER', 'ER', 'Ground')
on conflict do nothing;

insert into public.beds (tenant_id, id, ward_id, label, status) values
  ('00000000-0000-0000-0000-000000000001', 'BED-3B-12', 'WARD-3B', 'Bed 12', 'occupied'),
  ('00000000-0000-0000-0000-000000000001', 'BED-2A-04', 'WARD-2A', 'Bed 04', 'occupied'),
  ('00000000-0000-0000-0000-000000000001', 'BED-ICU-08', 'ICU', 'Bed 08', 'occupied'),
  ('00000000-0000-0000-0000-000000000002', 'BED-1A-03', 'WARD-1A', 'Bed 03', 'occupied'),
  ('00000000-0000-0000-0000-000000000002', 'BED-ICU-05', 'ICU', 'Bed 05', 'occupied')
on conflict do nothing;

insert into public.sample_types (tenant_id, id, name, container) select id, 'SAMPLE-BLOOD', 'Blood', 'EDTA / Plain tube' from public.tenants on conflict do nothing;
insert into public.sample_types (tenant_id, id, name, container) select id, 'SAMPLE-URINE', 'Urine', 'Sterile container' from public.tenants on conflict do nothing;
insert into public.investigation_categories (tenant_id, id, name, sort_order) select id, 'CAT-HEM', 'Haematology', 1 from public.tenants on conflict do nothing;
insert into public.investigation_categories (tenant_id, id, name, sort_order) select id, 'CAT-BIO', 'Biochemistry', 2 from public.tenants on conflict do nothing;
insert into public.investigation_catalog (tenant_id, id, code, name, category_id, department_id, sample_type_id, price, turnaround_hours, instructions)
select id, 'TEST-CBC', 'CBC', 'CBC / Complete haemogram', 'CAT-HEM', 'DEP-3', 'SAMPLE-BLOOD', 350, 6, 'EDTA sample' from public.tenants on conflict do nothing;
insert into public.investigation_catalog (tenant_id, id, code, name, category_id, department_id, sample_type_id, price, turnaround_hours, instructions)
select id, 'TEST-LFT', 'LFT', 'LFT', 'CAT-BIO', 'DEP-3', 'SAMPLE-BLOOD', 700, 8, 'Plain tube sample' from public.tenants on conflict do nothing;
insert into public.investigation_catalog (tenant_id, id, code, name, category_id, department_id, sample_type_id, price, turnaround_hours, instructions)
select id, 'TEST-RBS', 'RBS', 'Blood sugar - random', 'CAT-BIO', 'DEP-3', 'SAMPLE-BLOOD', 120, 2, 'Random sample' from public.tenants on conflict do nothing;

insert into public.pharmacy_stores (tenant_id, id, name, location) select id, 'STORE-MAIN', 'Main Pharmacy', 'Ground floor' from public.tenants on conflict do nothing;
insert into public.medicines (tenant_id, id, generic_name, brand_name, strength, dosage_form, manufacturer, reorder_level)
select id, 'MED-PARA-500', 'Paracetamol', 'Paracetamol', '500 mg', 'Tablet', 'Generic', 100 from public.tenants on conflict do nothing;
