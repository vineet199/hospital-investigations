# Supabase multi-tenant setup

This app now uses Supabase Auth + Postgres instead of the local SQLite API server.

For the full product roadmap, onboarding plan, role matrix, and commercial SaaS phases, see [`README.md`](./README.md).

For GitHub Pages demo deployment, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## 1. Create a Supabase project

Create a project at <https://supabase.com>, then copy:

- Project URL → `VITE_SUPABASE_URL` (best: `https://your-project-ref.supabase.co`; the app/seed script also normalize common Dashboard or `/rest/v1` pasted URLs)
- Anon public key → `VITE_SUPABASE_ANON_KEY`

Put them in a local `.env` file based on `.env.example`.

## 2. Apply the schema

Run the migrations in `supabase/migrations` in order in the Supabase SQL editor, or apply them through the Supabase CLI.

1. `001_multitenant_supabase.sql`
2. `002_onboarding_and_operations.sql`
3. `004_security_hardening.sql`
4. `005_low_latency_indexes.sql`

Optional cleanup migration/script for removing demo data before real onboarding:

- SQL: `supabase/migrations/003_remove_demo_seed_data.sql`
- Script: `pnpm unseed:supabase:confirm`

The migration creates:

- `tenants` for hospitals
- tenant-scoped departments, doctors, patients, investigations, timeline events, and audit events
- `tenant_memberships` for hospital staff roles
- Row Level Security policies so users only see hospitals they belong to
- RPC functions for investigation workflow mutations
- two demo hospitals: `city-general` and `sunrise-medical`

## 3. Create demo auth users

Option A: create users manually in Supabase Auth with password `demo123`, then run:

```sql
select public.link_demo_memberships();
```

Option B: set `SUPABASE_SERVICE_ROLE_KEY` in `.env`, then run:

```bash
pnpm seed:supabase
```

The seed script reads your local `.env` file automatically.

To remove the demo hospitals and demo auth users later, run:

```bash
pnpm unseed:supabase:confirm
```

Demo users:

- Platform admin: `platform@hims-saas.demo`
- `doctor@city-general.demo`
- `nurse@city-general.demo`
- `lab@city-general.demo`
- `radiology@city-general.demo`
- `admin@city-general.demo`
- `doctor@sunrise.demo`
- `nurse@sunrise.demo`
- `lab@sunrise.demo`
- `admin@sunrise.demo`

All demo passwords are `demo123`.

If platform admin login fails, confirm that `002_onboarding_and_operations.sql` has been applied and rerun:

```bash
pnpm seed:supabase
```

That command creates the `platform@hims-saas.demo` Auth user and links it to `public.platform_admins`.

## 4. Onboard a real hospital

Use the SaaS platform admin account, not a hospital account:

1. Sign in with `platform@hims-saas.demo` / `demo123` and select `SaaS Platform Admin`.
2. Open `/admin`.
3. Use **Platform admin — create hospital tenant** to create a hospital such as Manipal.
4. The RPC creates the tenant, settings, branding placeholder, trial subscription, enabled modules, default departments, and first hospital admin membership.
5. Create/invite the first hospital admin as a Supabase Auth user using your service role/admin process.
6. Give the hospital admin only their hospital credentials. You do not need City General or any other hospital’s credentials.

## 5. Run the app

```bash
pnpm install
pnpm dev
```

The frontend talks directly to Supabase. The legacy `server/index.mjs` SQLite API is no longer used by `pnpm dev`.

## 6. Validation

Run these checks after changing migrations, adapters, or onboarding flows:

```bash
pnpm typecheck
pnpm test
pnpm security:check
pnpm build
```

The frontend is wired through `src/lib/database`. Supabase is the implemented adapter, but additional adapters can be added for hospitals that require another backend.

## 7. Database indexing

Low-latency database indexes are defined in:

```text
supabase/migrations/005_low_latency_indexes.sql
```

Apply it after the main schema/security migrations.

Indexing rule used in this project:

```text
tenant_id first, then page-specific filters/status, then sort column
```

Examples:

```sql
-- Patient search within a hospital
create index if not exists patients_tenant_name_lower_idx
on public.patients (tenant_id, lower(name));

-- Department work queue
create index if not exists investigations_tenant_department_status_idx
on public.investigations (tenant_id, department_id, status, created_at desc);

-- Recent timeline/history
create index if not exists timeline_events_tenant_timestamp_idx
on public.timeline_events (tenant_id, timestamp desc);
```

This keeps queries fast and tenant-scoped. Use `EXPLAIN ANALYZE` in staging when adding new high-volume screens.
