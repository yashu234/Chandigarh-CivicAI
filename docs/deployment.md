# Chandigarh CivicAI — Deployment Guide
**Phase 13: Deployment & Demo Readiness**

---

## Overview

This guide covers deploying Chandigarh CivicAI to production using **Vercel** (recommended for frontend) and **remote Supabase** (managed cloud PostgreSQL + Auth + Storage + Edge Functions). No containers or self-hosted infra are required.

> [!IMPORTANT]
> Chandigarh CivicAI is **civic-grade software** handling grievance data from citizens. Follow all security steps exactly. Never bypass RLS, expose service-role keys, or use real citizen personal data in demo/staging environments.

---

## Table of Contents

1. [Pre-deployment Checklist](#1-pre-deployment-checklist)
2. [Supabase Production Setup](#2-supabase-production-setup)
3. [Edge Function Secrets](#3-edge-function-secrets)
4. [Frontend Deployment (Vercel)](#4-frontend-deployment-vercel)
5. [Post-Deploy Verification](#5-post-deploy-verification)
6. [Security Headers](#6-security-headers)
7. [CI/CD (GitHub Actions)](#7-cicd-github-actions)
8. [Rollback & Recovery](#8-rollback--recovery)

---

## 1. Pre-deployment Checklist

Before deploying, confirm every item:

- [ ] `npm run build` exits with code 0 (no TypeScript errors)
- [ ] `npm run lint` exits with code 0 (no lint errors)
- [ ] All 135 tests pass: `node test/phase{6..12}_*tests.mjs`
- [ ] `.env.local` is **not** committed (verified by `.gitignore`)
- [ ] No `VITE_*_API_KEY` or `VITE_SERVICE_ROLE_KEY` in codebase
- [ ] `supabase/schema.sql` is the single source of truth for the DB schema
- [ ] `supabase/migrations/` contains all 7 migration files in order
- [ ] `supabase/seed.sql` contains only synthetic `CHD-TEST-*` demo data
- [ ] Supabase project is in a region closest to your users (recommend `ap-south-1` / Mumbai for India)

---

## 2. Supabase Production Setup

### 2.1 Create a Production Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New Project**.
3. Name: `chandigarh-civicai-prod`
4. Region: `ap-south-1` (Mumbai) or nearest.
5. Generate and store a strong database password in a secrets manager (e.g. 1Password, AWS Secrets Manager).

### 2.2 Apply the Schema

1. In your Supabase dashboard: **SQL Editor → New Query**.
2. Copy-paste the full contents of `supabase/schema.sql` and click **Run**.
3. Verify output shows no errors.

### 2.3 Apply All Incremental Migrations

Apply each migration **in order** using the SQL Editor:

| Order | File | Phase |
|-------|------|-------|
| 1 | `20261013000000_civicai_initial_schema.sql` | Phase 3 |
| 2 | `20261013010000_phase5_tracking_id_generator.sql` | Phase 5 |
| 3 | `20261013015000_phase9_duplicate_status_check.sql` | Phase 9 |
| 4 | `20261013018000_phase10_complaint_duplicates.sql` | Phase 10 |
| 5 | `20261013020000_phase11_notifications.sql` | Phase 11 |
| 6 | `20261013030000_phase12_security_hardening.sql` | Phase 12 |
| 7 | `20261013040000_phase13_demo_seed_guard.sql` | Phase 13 |

> [!NOTE]
> If you are starting from scratch and applied `schema.sql` above, you **only need migrations 3–7** (schema.sql already includes phases 3–5 structure). When in doubt, each migration is written idempotently with `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE`.

### 2.4 (Optional) Apply Demo Seed Data to Staging Only

For staging/demo environments:
```sql
-- Copy contents of supabase/seed.sql and run in SQL Editor (staging project only)
```

> [!CAUTION]
> **NEVER apply seed.sql to a production project** that has real citizens registered. Seed data uses deterministic UUIDs that could conflict with real user IDs.

### 2.5 Verify Remote Schema

Run the built-in readiness check in Supabase SQL Editor:
```sql
SELECT * FROM public.demo_readiness_check();
```

Expected output:

| check_name | status | detail |
|---|---|---|
| RLS enabled on all core tables | PASS | Tables with RLS: 8/8 |
| Demo seed data present | PASS / WARN | Demo complaints found: 6 |
| No permissive wildcard RLS policies | PASS | Permissive policies: 0 |
| Complaint tracking sequence initialized | PASS | Sequence last_value: ≥101 |

### 2.6 Provision the First Admin

Use the `provision_admin()` stored function to safely elevate the first admin user:
```sql
-- Replace with the real admin user's UUID from auth.users
SELECT public.provision_admin('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
```

> [!WARNING]
> This function is SECURITY DEFINER. It strictly prevents self-escalation and can only be called by `service_role` or `postgres`. Never call it from client-side code.

### 2.7 Create Storage Bucket

1. In Supabase: **Storage → New bucket**.
2. Name: `complaint-evidence`
3. **Public**: OFF (private bucket — access via signed URLs only).
4. Click **Create bucket**.

Verify storage policies were applied by the schema (they should restrict uploads to authenticated users and reads to complaint owners + admins).

---

## 3. Edge Function Secrets

The `analyze-complaint-evidence` Edge Function requires server-side secrets. These are **never** exposed to the browser.

### Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your production project
supabase link --project-ref <your-project-id>

# Set the Gemini API key (server-side only)
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>

# Deploy the edge function
supabase functions deploy analyze-complaint-evidence --no-verify-jwt
```

> [!CAUTION]
> Do NOT run `supabase secrets set` with keys visible in shell history. Use:
> ```bash
> read -s GEMINI_API_KEY && supabase secrets set GEMINI_API_KEY=$GEMINI_API_KEY
> ```

### Via Supabase Dashboard

1. Go to **Project Settings → Edge Functions → Secrets**.
2. Add secret: Name = `GEMINI_API_KEY`, Value = your key.
3. Click **Save**.

---

## 4. Frontend Deployment (Vercel)

### 4.1 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Or manually:

```bash
# Install Vercel CLI
npm install -g vercel

# From the project root
vercel --prod
```

### 4.2 Environment Variables in Vercel Dashboard

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value | Environments |
|---|---|---|
| `VITE_APP_NAME` | `Chandigarh CivicAI` | Production, Preview |
| `VITE_APP_ENV` | `production` | Production only |
| `VITE_APP_ENV` | `staging` | Preview only |
| `VITE_APP_URL` | `https://your-domain.vercel.app` | Production |
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` | All |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | All |
| `VITE_SUPABASE_EVIDENCE_BUCKET` | `complaint-evidence` | All |

> [!CAUTION]
> `VITE_SUPABASE_ANON_KEY` is the **public anon key only**. Never set `service_role` or `GEMINI_API_KEY` in Vercel env vars (they would be exposed to the browser).

### 4.3 Vercel Build Settings

These are auto-detected but verify:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Node.js Version**: 18.x or 20.x

### 4.4 Custom Domain (Optional)

In Vercel → Domains, add your domain (e.g. `civicai.chandigarh.gov.in`).

---

## 5. Post-Deploy Verification

After deployment, verify the following manually:

### 5.1 Application Health
- [ ] `https://your-deployment-url/` loads the landing page
- [ ] `/register` — citizen registration form renders
- [ ] `/login` — login form renders
- [ ] `/admin/login` — admin login form renders

### 5.2 Authentication Flow
1. Register a new test citizen account.
2. Log in with that account.
3. Verify redirect to `/dashboard`.
4. Log out, verify session cleared.

### 5.3 Complaint Submission
1. Log in as a citizen.
2. Navigate to `/submit`.
3. Submit a test complaint with all required fields.
4. Verify complaint appears in `/dashboard` with a `CHD-YYYY-NNNNN` tracking ID.

### 5.4 Admin Workflow
1. Log in with the provisioned admin account.
2. Navigate to `/admin/dashboard`.
3. Verify priority-sorted complaint queue appears.
4. Transition a complaint through at least one status step.
5. Verify status history audit trail updated.

### 5.5 Security Verification
```bash
# Run the full Phase 12 security test suite against the local codebase
node test/phase12_security_tests.mjs

# All 28/28 tests must pass before considering deployment complete
```

---

## 6. Security Headers

The `vite.config.ts` configures CSP headers for `npm run preview`. For production on **Vercel**, add a `vercel.json` at the project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
      ]
    }
  ]
}
```

---

## 7. CI/CD (GitHub Actions)

Create `.github/workflows/ci.yml` for automated quality gates:

```yaml
name: CivicAI CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint check
        run: npm run lint

      - name: Phase 12 security tests
        run: node test/phase12_security_tests.mjs

      - name: All unit tests
        run: |
          node test/phase6_tests.mjs
          node test/phase7_tests.mjs
          node test/phase8_tests.mjs
          node test/phase9_tests.mjs
          node test/phase9_patch_tests.mjs
          node test/phase10_tests.mjs
          node test/phase11_tests.mjs
          node test/phase13_demo_readiness.mjs

      - name: Production build
        run: npm run build
        env:
          VITE_APP_ENV: production
          VITE_SUPABASE_URL: https://placeholder.supabase.co
          VITE_SUPABASE_ANON_KEY: placeholder-anon-key
          VITE_SUPABASE_EVIDENCE_BUCKET: complaint-evidence
```

---

## 8. Rollback & Recovery

### Frontend Rollback
Vercel maintains a deployment history. To rollback:
1. Go to **Vercel → Deployments**.
2. Find the last known-good deployment.
3. Click **Promote to Production**.

### Database Rollback
Each migration file corresponds to an additive phase. To roll back a migration:
1. Open Supabase SQL Editor.
2. Run the inverse SQL manually (each migration file comments describe what was added).
3. There is no automated rollback — always test migrations on staging first.

### Emergency: Disable AI Edge Function
If the Gemini integration causes issues:
1. In Supabase: **Edge Functions → analyze-complaint-evidence → Pause**.
2. The frontend gracefully handles AI unavailability — complaints continue to be accepted with `human_review_required = true`.
