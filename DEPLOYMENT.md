# Demo Deployment Guide

This guide is for a **demo deployment** of the Hospital Investigation System on GitHub Pages.

For production hospital SaaS deployments, prefer Cloudflare Pages, Vercel, Netlify, AWS, Azure, or a dedicated hospital/private-cloud deployment with stronger controls.

## Demo architecture

- Frontend: GitHub Pages static site
- Auth/database: Supabase demo/staging project
- Build output: `dist/public`
- SPA fallback: `dist/public/404.html` copied from `index.html`

## 1. Prepare Supabase

Use a demo or staging Supabase project, not production.

Apply migrations in order:

1. `supabase/migrations/001_multitenant_supabase.sql`
2. `supabase/migrations/002_onboarding_and_operations.sql`
3. `supabase/migrations/004_security_hardening.sql`

Then seed demo users:

```bash
pnpm seed:supabase
```

Demo platform admin:

- Select hospital/workspace: `SaaS Platform Admin`
- Email: `platform@hims-saas.demo`
- Password: `demo123`

## 2. Configure GitHub Pages

In GitHub repository settings:

1. Go to **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.

## 3. Add GitHub secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

```text
VITE_SUPABASE_URL=https://your-demo-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-demo-anon-key
```

Optional repo variable under **Variables**:

```text
VITE_DATABASE_PROVIDER=supabase
```

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` as a frontend Pages secret unless you are using it only in a separate trusted server-side/admin workflow. It must never be exposed to browser code.

## 4. Deploy

Push to `main` or manually run:

```text
Actions → Deploy demo to GitHub Pages → Run workflow
```

The app will deploy to:

```text
https://<github-user-or-org>.github.io/<repo-name>/
```

For this repo, the default base path is generated as:

```text
/<repo-name>/
```

## 5. Custom domain

If you configure a custom domain like:

```text
https://demo.yourcompany.com
```

change the workflow `BASE_PATH` to:

```text
/
```

## 6. Local demo build

For local verification:

```bash
pnpm install
pnpm security:check
pnpm typecheck
pnpm test
pnpm build:github
```

## 7. GitHub Pages caveats

- GitHub Pages is acceptable for demos/staging, not recommended as the final healthcare SaaS production host.
- Security headers in `public/_headers` are not applied by GitHub Pages; they are useful for Netlify/Cloudflare-style hosting.
- No server-side functions are available on GitHub Pages.
- Service-role/admin operations must run elsewhere.
