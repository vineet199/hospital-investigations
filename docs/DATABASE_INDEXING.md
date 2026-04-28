# Database Indexing Strategy

This SaaS is multi-tenant. Indexes are designed around tenant-scoped access patterns.

## Core rule

Most indexes should start with:

```sql
tenant_id
```

Then include the fields used by the screen/API:

1. tenant filter: `tenant_id`
2. entity/page filter: e.g. `patient_id`, `department_id`, `medicine_id`
3. status/category filter: e.g. `status`, `payment_status`
4. sort field: e.g. `created_at desc`, `timestamp desc`

## Current index migration

Indexes are in:

```text
supabase/migrations/005_low_latency_indexes.sql
```

## Current indexes

```sql
create index if not exists patients_tenant_name_lower_idx
on public.patients (tenant_id, lower(name));

create index if not exists patients_tenant_phone_idx
on public.patients (tenant_id, phone);

create index if not exists investigations_tenant_department_status_idx
on public.investigations (tenant_id, department_id, status, created_at desc);

create index if not exists investigations_tenant_status_created_idx
on public.investigations (tenant_id, status, created_at desc);

create index if not exists timeline_events_tenant_timestamp_idx
on public.timeline_events (tenant_id, timestamp desc);

create index if not exists invoices_tenant_patient_status_idx
on public.invoices (tenant_id, patient_id, payment_status, created_at desc);

create index if not exists medicine_batches_tenant_medicine_expiry_idx
on public.medicine_batches (tenant_id, medicine_id, expiry_date);
```

## What they optimize

| Screen/workflow | Index |
|---|---|
| Patient search | `patients_tenant_name_lower_idx`, `patients_tenant_phone_idx` |
| Patient detail investigations | existing `investigations_tenant_patient_idx` |
| Department queue | `investigations_tenant_department_status_idx` |
| Dashboard summary | `investigations_tenant_status_created_idx` |
| History/recent activity | `timeline_events_tenant_timestamp_idx` |
| Billing by patient/status | `invoices_tenant_patient_status_idx` |
| Pharmacy stock/expiry | `medicine_batches_tenant_medicine_expiry_idx` |

## RPC helpers

The same migration adds:

```sql
get_dashboard_summary(p_tenant_id uuid)
get_department_queue(p_tenant_id uuid, p_department_id text)
```

These return screen-ready JSON and reduce frontend round trips.

## Adding new indexes

Use this template:

```sql
create index if not exists <table>_tenant_<filter>_<sort>_idx
on public.<table> (tenant_id, <filter_column>, <status_column>, <sort_column> desc);
```

Example for appointments:

```sql
create index if not exists appointments_tenant_date_status_idx
on public.appointments (tenant_id, appointment_date, status);
```

## Verification

Before production rollout, test slow queries in staging:

```sql
explain analyze
select *
from public.investigations
where tenant_id = '<tenant-id>'
  and department_id = 'DEP-3'
  and status in ('Sent to Department', 'In Progress', 'Result Ready')
order by created_at desc
limit 100;
```

If Postgres does not use the expected index, revisit column order and query shape.
