# Supabase multi-tenant setup

This app now uses Supabase Auth + Postgres instead of the local SQLite API server.

## 1. Create a Supabase project

Create a project at <https://supabase.com>, then copy:

- Project URL → `VITE_SUPABASE_URL` (best: `https://your-project-ref.supabase.co`; the app/seed script also normalize common Dashboard or `/rest/v1` pasted URLs)
- Anon public key → `VITE_SUPABASE_ANON_KEY`

Put them in a local `.env` file based on `.env.example`.

## 2. Apply the schema

Run `supabase/migrations/001_multitenant_supabase.sql` in the Supabase SQL editor, or apply it through the Supabase CLI.

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

Demo users:

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

## 4. Run the app

```bash
pnpm install
pnpm dev
```

The frontend talks directly to Supabase. The legacy `server/index.mjs` SQLite API is no longer used by `pnpm dev`.
