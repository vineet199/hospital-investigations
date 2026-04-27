# Security Policy

This application handles hospital operational data and patient health information. Treat security as a release blocker, not a nice-to-have.

## Production security baseline

Before onboarding a real hospital, complete this checklist:

- Remove demo tenants and demo users with `pnpm unseed:supabase:confirm`.
- Rotate any key that was ever pasted into chat, committed, emailed, or shared outside the secret manager.
- Keep service-role keys server-side only. Never expose them to Vite/browser code.
- Enforce MFA for SaaS platform admins and hospital admins.
- Verify RLS is enabled on every tenant-owned table.
- Verify known-ID cross-tenant access is denied.
- Use private storage buckets for reports, signatures, uploaded documents, and patient files.
- Use short-lived signed URLs for report/document downloads.
- Configure automated backups and test restore at least once before go-live.
- Enable error monitoring, uptime monitoring, and security alerting.
- Run `pnpm security:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before every release.

## Tenant isolation rules

- Every hospital-owned table must include `tenant_id`.
- Every RLS policy must verify membership in that tenant.
- Every mutation must verify role and tenant membership server-side.
- The browser must never be the only enforcement point.
- Platform admins must not get blanket patient-data visibility by default.

## Platform admin / SaaS owner access

The SaaS company should use separate platform admin accounts, not customer hospital accounts.

Recommended policy:

- Platform admin can create/suspend tenants and manage subscriptions/modules.
- Platform admin cannot access patient data by default.
- Support access to PHI should use a break-glass workflow with reason, expiry, and audit trail.
- All platform admin accounts must use MFA.

## Secrets handling

- `.env` is ignored by git and must stay local.
- `.env.example` must contain placeholders only.
- Service-role keys belong only in secure server environments or local admin scripts.
- Rotate keys immediately after suspected exposure.
- Run `pnpm security:check` to scan for common leaked JWT/service-role patterns in files that should not contain secrets.

## Dependency and code security

Use:

```bash
pnpm security:check
pnpm audit --audit-level high
pnpm typecheck
pnpm test
pnpm build
```

## Reporting vulnerabilities

Until a formal security mailbox is configured, report issues directly to the repository owner privately. Do not create public issues for vulnerabilities containing exploit details or patient data.
