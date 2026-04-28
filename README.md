# Hospital Investigation System — Multi-Tenant SaaS Plan

This project is evolving from a single-hospital investigation tracker into a Supabase-backed, multi-tenant hospital SaaS product. The goal is to let multiple hospitals use the same application while keeping every hospital’s patients, staff, investigations, reports, billing, pharmacy data, and audit logs isolated by tenant.

See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for Supabase environment setup, migrations, and demo user seeding.

For demo deployment on GitHub Pages, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Database provider boundary

Hospitals may not always allow Supabase. The frontend now goes through a database adapter boundary under `src/lib/database` instead of calling Supabase directly from app code.

Current implementation:

- `src/lib/database/types.ts` defines the provider interface.
- `src/lib/database/supabaseAdapter.ts` implements the interface with Supabase.
- `src/lib/database/index.ts` selects the provider through `VITE_DATABASE_PROVIDER`.

To support another hospital-preferred backend, implement the same adapter interface for that backend, for example:

- PostgreSQL behind your own API
- Microsoft SQL Server behind hospital VPN/API
- MySQL/MariaDB
- Oracle
- on-prem FHIR/HIS integration layer

The adapter must provide auth/session operations, row reads, and RPC/action calls. The UI should remain mostly unchanged if the adapter contract is honored.

### Test coverage

Unit tests are available through Vitest:

```bash
pnpm test
```

Current tests cover Supabase URL normalization, including accidental `/rest/v1` or `/auth/v1` URLs and Supabase Dashboard URLs. Add new adapter contract tests whenever another database provider is implemented.

Run the lightweight secret/security scan before committing:

```bash
pnpm security:check
```

For a GitHub Pages demo build, use:

```bash
pnpm build:github
```

## Low-latency design

The app now uses route-level code splitting with `React.lazy` so admin, pharmacy, billing, patient detail, and department workbench code is not all loaded in the first bundle. The Vite build also defines manual chunks for React, Supabase, query, charts, and Radix UI libraries.

Database-side latency helpers live in `supabase/migrations/005_low_latency_indexes.sql`:

- patient search indexes
- investigation status/department indexes
- timeline timestamp indexes
- billing/pharmacy indexes
- `get_dashboard_summary` RPC
- `get_department_queue` RPC

### How database indexing is done

All performance indexes are created in an additive migration:

```text
supabase/migrations/005_low_latency_indexes.sql
```

The indexing strategy follows the most common access pattern in this SaaS: **every query is tenant-scoped first**, then filtered/sorted by the page-specific field.

Examples:

```sql
create index if not exists patients_tenant_name_lower_idx
on public.patients (tenant_id, lower(name));

create index if not exists investigations_tenant_department_status_idx
on public.investigations (tenant_id, department_id, status, created_at desc);

create index if not exists timeline_events_tenant_timestamp_idx
on public.timeline_events (tenant_id, timestamp desc);
```

Why `tenant_id` comes first:

- It keeps each hospital’s data isolated in query plans.
- It helps Postgres quickly narrow results to one hospital.
- It matches RLS and application filters.

What each index supports:

| Index | Used for |
|---|---|
| `patients_tenant_name_lower_idx` | patient search by name inside a hospital |
| `patients_tenant_phone_idx` | patient search by phone/contact |
| `investigations_tenant_department_status_idx` | department queue screens: queued/in-progress/result-ready |
| `investigations_tenant_status_created_idx` | dashboard/status summaries |
| `timeline_events_tenant_timestamp_idx` | recent activity/history views |
| `invoices_tenant_patient_status_idx` | billing lookup by patient/payment status |
| `medicine_batches_tenant_medicine_expiry_idx` | pharmacy stock and expiry lookups |

The migration also adds RPC helpers:

```sql
get_dashboard_summary(p_tenant_id uuid)
get_department_queue(p_tenant_id uuid, p_department_id text)
```

These reduce network round trips by returning screen-ready data from the database in one call.

When adding a new page/table, add an index based on:

1. `tenant_id`
2. the main filter column
3. the main status/category column if applicable
4. the sort column, usually `created_at desc` or `timestamp desc`

For example, a future appointments page might use:

```sql
create index appointments_tenant_date_status_idx
on public.appointments (tenant_id, appointment_date, status);
```

Always verify large-query performance with `EXPLAIN ANALYZE` in staging before production rollout.

Next recommended latency improvements are route-level React Query data fetching, optimistic mutation updates, and realtime subscriptions scoped to a patient or department instead of broad tenant-wide refreshes.

## Current foundation

Implemented foundation:

- Supabase Auth login.
- Supabase Postgres database.
- Tenant table for hospitals.
- Tenant-scoped patients, doctors, departments, investigations, timeline events, and audit events.
- Tenant memberships for staff access.
- Row Level Security policies for tenant isolation.
- RPC functions for investigation workflow transitions.
- Demo hospitals and demo users.
- Hospital-aware login UI.
- Active hospital display in the app shell.
- Hospital-style investigation requisition form with patient details and test checklists.

Important limitation: the original foundation is strong enough for a demo/MVP, but selling this to multiple real hospitals requires onboarding, configuration, billing, reports, pharmacy, and commercial operations. The plan below defines those additions.

---

## Multi-tenant architecture

Every hospital is represented by a tenant. All hospital-owned tables must include `tenant_id`.

Tenant-owned records include:

- departments
- doctors
- patients
- staff memberships
- investigations
- timeline events
- audit events
- wards and beds
- admissions
- investigation catalog/tests
- invoices and payments
- pharmacy stock
- reports
- subscription/usage data

Tenant isolation must be enforced in Supabase through RLS and server-side RPC functions. React route guards are useful for UX but are not a security boundary.

---

## Role model

Supported/planned roles:

- Platform Admin
- Admin
- Doctor
- Nurse
- Technician
- Department Head
- Pharmacist
- Billing
- Reception

Recommended permission matrix:

| Action | Platform Admin | Hospital Admin | Doctor | Nurse | Technician | Department Head | Pharmacist | Billing | Reception |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Create hospital | Yes | Optional | No | No | No | No | No | No | No |
| Configure hospital | Yes | Yes | No | No | No | No | No | No | No |
| Invite staff | Yes | Yes | No | No | No | No | No | No | No |
| Register patient | Optional | Yes | Optional | Yes | No | No | No | No | Yes |
| Create investigation order | No | Yes | Yes | Optional | No | No | No | No | Optional |
| Dispatch investigation | No | Yes | Yes | Yes | No | No | No | No | Optional |
| Process investigation | No | Yes | No | No | Yes | Yes | No | No | No |
| Save result | No | Yes | No | No | Yes | Yes | No | No | No |
| Review result | No | Yes | Yes | No | No | No | No | No | No |
| Manage pharmacy | No | Yes | No | No | No | No | Yes | No | No |
| Manage bills | No | Yes | No | No | No | No | No | Yes | Optional |
| View audit logs | Yes | Yes | Limited | Limited | Limited | Limited | Limited | Limited | Limited |

---

## Combined Phase 1–4: Hospital Operations & Onboarding MVP

This combined phase turns the app into a usable multi-hospital operations MVP.

### 1. Platform admin console

Purpose: allow the SaaS owner to onboard hospitals without manually editing SQL.

Required capabilities:

- Create hospital tenant.
- Set hospital name and slug.
- Add address, phone, email, logo, and branding.
- Create first hospital admin membership.
- Enable/disable modules per hospital.
- Select plan/trial status.
- Suspend/reactivate hospital.

Acceptance criteria:

- Platform admin can create a hospital from UI.
- First hospital admin can log in.
- New hospital receives isolated default data.

### 2. Hospital admin setup

Purpose: let each hospital configure itself.

Required capabilities:

- Hospital profile and branding.
- Department setup.
- Ward setup.
- Bed setup.
- Staff invitations.
- Role assignment.
- Department assignment.
- Staff activation/deactivation.

Acceptance criteria:

- Hospital admin can invite doctors, nurses, technicians, pharmacists, billing users, and reception users.
- Invited staff are tenant-scoped.
- Disabled staff lose access.

### 3. Doctor onboarding and profiles

Doctor fields:

- name
- email
- phone
- department
- specialty
- qualification
- medical registration number
- signature image URL
- stamp image URL
- active/inactive status

Acceptance criteria:

- Doctor profile links to staff membership.
- Doctor can order investigations.
- Doctor can review results.
- Doctor identity can appear on requisitions/reports.

### 4. Patient registration and admission

Patient fields:

- MRN
- name
- DOB/age
- gender
- phone
- alternate phone
- address
- guardian
- emergency contact
- ID proof type/number
- insurance/corporate information
- OPD/IPD/Emergency/Day care class
- ward
- bed
- admission/discharge status

Acceptance criteria:

- Reception/admin can register patients.
- MRNs are unique per hospital.
- Patient details are editable.
- Admissions and bed assignments are tenant-scoped.

### 5. Investigation/test catalog

Purpose: replace hard-coded requisition checkboxes with hospital-specific catalog data.

Catalog fields:

- test name
- test code
- category
- department/lab
- sample type
- container type
- fasting required
- instructions
- turnaround time
- price
- active/inactive
- reference range
- report template

Acceptance criteria:

- Hospital admin can add/edit tests.
- Doctors see only active tests for their hospital.
- Orders route to correct departments.
- Test prices can feed billing.

### 6. Billing MVP

Required capabilities:

- Generate invoice from investigation orders.
- Add invoice items.
- Capture payments.
- Track payment status.
- Support Cash/Card/UPI/Insurance/Corporate/Package.

Acceptance criteria:

- Billing user can create an invoice.
- Invoice data is tenant-scoped.
- Investigation orders can become billable items.

### 7. Reports, PDFs, and printing

Required documents:

- investigation requisition slip
- lab result report
- radiology report
- invoice/receipt
- patient investigation history

Required capabilities:

- print-friendly layout
- hospital logo/header/footer
- doctor name/signature placeholder
- QR verification placeholder
- draft/final/amended status

### 8. Pharmacy foundation

Required capabilities:

- pharmacist onboarding
- pharmacy stores
- medicine catalog
- batches
- expiry dates
- stock movements
- prescription queue
- dispensing workflow

Acceptance criteria:

- Pharmacist can log in.
- Pharmacist sees only their hospital data.
- Stock adjustment is audited.
- Dispensing reduces batch stock.

### 9. Audit and security controls

Required capabilities:

- audit log UI
- filters by user/action/entity/date
- sensitive action logging
- user deactivation
- invite resend/password reset path
- tenant isolation verification

---

## Phase 5: SaaS Commercial Readiness & Scale

Phase 5 is for operating and selling this product across multiple hospitals.

### Subscription and plan management

Plans:

- Trial
- Basic
- Pro
- Enterprise

Track:

- subscription status
- trial expiry
- enabled modules
- user limits
- patient limits
- monthly investigation limits
- storage limits
- suspension/reactivation

### Usage tracking

Track per tenant:

- active users
- registered patients
- investigations/month
- reports generated
- invoices generated
- pharmacy transactions
- storage usage

### Custom branding and domains

Add:

- logo
- brand color
- report header/footer
- subdomain
- enterprise custom domain placeholder

### Data import/export

Add:

- patient CSV import
- staff CSV import
- test catalog import
- medicine catalog import
- tenant-scoped export
- import validation errors

### Backup, restore, and compliance

Add:

- backup process
- restore process
- data retention settings
- audit export
- PHI/privacy documentation
- support/legal documentation

### Monitoring and support

Add:

- error logging
- performance monitoring
- support ticket/contact flow
- tenant health dashboard
- support impersonation with audit logging

---

## Implementation order

1. Documentation and roadmap.
2. Supabase schema expansion.
3. Store/types expansion.
4. Admin navigation.
5. Platform admin console.
6. Hospital settings.
7. Staff management.
8. Patient registration/admission.
9. Database-backed test catalog.
10. Billing MVP.
11. Reports/printing MVP.
12. Pharmacy foundation.
13. Audit/security UI.
14. Phase 5 subscription/usage/commercial scaffolding.

---

## Current status

This repository now contains the multi-tenant technical base. The next milestones are the onboarding/admin screens and the operational SaaS modules listed above.
