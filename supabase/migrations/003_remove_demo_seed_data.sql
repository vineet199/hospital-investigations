-- Remove demo/pre-seeded data while keeping the multi-tenant schema intact.
-- This only targets the known demo hospitals and demo auth users created by the seed scripts.
-- Run manually in the Supabase SQL editor if you want a clean database before onboarding real hospitals.

begin;

delete from public.platform_admins
where lower(email) in (
  'platform@hims-saas.demo',
  'doctor@city-general.demo',
  'nurse@city-general.demo',
  'lab@city-general.demo',
  'radiology@city-general.demo',
  'pharmacist@city-general.demo',
  'admin@city-general.demo',
  'doctor@sunrise.demo',
  'nurse@sunrise.demo',
  'lab@sunrise.demo',
  'pharmacist@sunrise.demo',
  'admin@sunrise.demo'
);

-- Cascades through tenant-owned tables: departments, doctors, patients,
-- investigations, memberships, billing, pharmacy, catalog, reports, etc.
delete from public.tenants
where slug in ('city-general', 'sunrise-medical')
   or id in (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  );

-- Optional auth cleanup for demo users. Supabase SQL editor/service-role contexts
-- can run this; if your environment blocks direct auth schema writes, use:
--   pnpm unseed:supabase
delete from auth.users
where lower(email) in (
  'platform@hims-saas.demo',
  'doctor@city-general.demo',
  'nurse@city-general.demo',
  'lab@city-general.demo',
  'radiology@city-general.demo',
  'pharmacist@city-general.demo',
  'admin@city-general.demo',
  'doctor@sunrise.demo',
  'nurse@sunrise.demo',
  'lab@sunrise.demo',
  'pharmacist@sunrise.demo',
  'admin@sunrise.demo'
);

commit;
