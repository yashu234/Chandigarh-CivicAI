# Chandigarh CivicAI — Comprehensive Security Audit & Verification Report
**Phase 12: Security Hardening, Integration Testing & Production-Readiness Verification**
**Jurisdiction: Union Territory of Chandigarh (MCC & UT Engineering Department)**
**Audit Date: October 2026**

---

## 1. Executive Summary & Security Posture

This audit report documents the security hardening, verification methodology, and defensive architecture of **Chandigarh CivicAI**. In accordance with Phase 12 guidelines, the application has undergone systematic static analysis, Row Level Security (RLS) policy inspection, storage access auditing, API boundary testing, input sanitization verification, and failure-path integration testing.

### Key Assurance Summary
- **Zero Permissive RLS Policies**: Verified that no `USING (true)` or `WITH CHECK (true)` policies exist in the database schema or migration scripts.
- **Strict Role Isolation**: Verified that citizen users cannot access administrative command queues, cannot promote their own roles, cannot mutate complaint status, cannot alter calculated/effective priority tiers, and cannot insert audit log records.
- **Zero Client-Side Privileged Secrets**: Verified that no Supabase `service_role` keys, Gemini API keys, or private administrative tokens exist in client-side Vite bundles or source files.
- **Storage Privacy**: Verified that the evidence storage bucket is non-public, requiring authenticated user ownership or administrative privileges. Short-lived signed URLs are used exclusively.
- **Multimodal AI Safety Guardrails**: Verified that Gemini multimodal inference runs exclusively within a protected backend Supabase Edge Function, enforcing strict numeric bounds `[0.00, 100.00]`, runaway response rejection, and independent municipal human-review triggers.
- **Audit Immutability**: Status transition logs and administrative actions are immutable. Database triggers prevent citizens from altering administrative notification content.

> [!NOTE]
> In compliance with municipal governance standards, this document uses precise security classifications: **verified**, **mitigated**, **known limitation**, and **requires production configuration**. We explicitly do not claim the system is "100% unbreakable."

---

## 2. Threat Model & Security Boundaries

```
[ Unauthenticated Internet ]
           │
           ▼ (HTTPS / TLS 1.3)
   ┌───────────────┐
   │ Reverse Proxy │
   │   (Vite/CDN)  │
   └───────┬───────┘
           │ (Public Anon Key)
   ┌───────▼────────────────────────────────────────────────┐
   │                SUPABASE BACKEND GATEWAY                │
   │                                                        │
   │  ┌─────────────────┐       ┌────────────────────────┐  │
   │  │   Auth Engine   │       │  Supabase Storage      │  │
   │  │ (JWT Validation)│       │  ('complaint-evidence')│  │
   │  └────────┬────────┘       │  [Private Bucket]      │  │
   │           │                └───────────▲────────────┘  │
   │  ┌────────▼────────────────────────────┴────────────┐  │
   │  │      PostgreSQL Database with RLS Policies       │  │
   │  │                                                  │  │
   │  │  • public.profiles              (Role lock)      │  │
   │  │  • public.complaints            (Admin UPDATE)   │  │
   │  │  • public.complaint_evidence    (Owner SELECT)   │  │
   │  │  • public.ai_assessments        (Admin/Service)  │  │
   │  │  • public.complaint_status_hist (Immutable log)  │  │
   │  │  • public.admin_actions         (Admin-only)     │  │
   │  │  • public.complaint_duplicates  (Advisory pair)  │  │
   │  │  • public.notifications         (Owner read_at)  │  │
   │  └──────────────────────┬───────────────────────────┘  │
   │                         │                              │
   │  ┌──────────────────────▼───────────────────────────┐  │
   │  │   Supabase Edge Function                         │  │
   │  │   'analyze-complaint-evidence'                   │  │
   │  │   [Backend Secrets: GEMINI_API_KEY]              │  │
   │  └──────────────────────┬───────────────────────────┘  │
   └─────────────────────────┼──────────────────────────────┘
                             ▼ (HTTPS POST)
                 ┌───────────────────────┐
                 │ Google Gemini API     │
                 │ (gemini-1.5-flash)    │
                 └───────────────────────┘
```

### Threat Actors & Vectors Analyzed

| Threat Actor | Potential Vector | Mitigation Strategy | Status |
| :--- | :--- | :--- | :--- |
| **Anonymous Attacker** | Unauthenticated access to civic grievances, private photos, or internal notifications | Enforced RLS requiring `TO authenticated`; default bucket `public = false`; ProtectedRoute navigation guards | **Verified** |
| **Malicious Citizen** | Horizontal privilege escalation: querying or downloading another resident's complaint or evidence | Strict RLS queries verifying `c.citizen_id = auth.uid()`; storage folder segmentation `complaints/{complaint_id}/` | **Verified** |
| **Malicious Citizen** | Vertical privilege escalation: promoting account to `role = 'admin'` | RLS `WITH CHECK (role = 'citizen')` + DB trigger `trigger_enforce_profile_role` overriding `role := 'citizen'` on INSERT/UPDATE | **Verified** |
| **Malicious Citizen** | Unauthorized data mutation: changing status to 'resolved' or setting high priority | complaints UPDATE policy gated strictly by `public.is_admin()`; citizens possess zero UPDATE policy | **Verified** |
| **Malicious Citizen** | Notification tampering: modifying notification title/message to impersonate officials | DB trigger `trg_enforce_notification_read_only` strictly raises exception if citizens modify any field other than `read_at` | **Verified** |
| **Malicious Submitter** | Path traversal in evidence upload | Strict sanitization of `complaintId` (`[^a-zA-Z0-9-]`) and `filename` (`replace(/\.\./g, '_')`); UUID prefix injection | **Verified** |
| **Malformed AI / Injection**| Runaway output, out-of-range priority scores, NaN/Infinity injection | Schema `CHECK (score >= 0 AND score <= 100)`; Edge Function validator rejects > 2500 char reasoning or non-finite numbers | **Verified** |

---

## 3. Authentication & Session Security

### 3.1 Session Validation & Verification
- **Session Origin**: Authenticated state is derived exclusively from the cryptographic Supabase Auth session token (JWT). No client-side storage value (`localStorage`, cookie, or React state) is trusted as authoritative for permission checks.
- **Role Verification**: Administrative status is determined authoritatively by querying `public.profiles.role = 'admin'`. In `verifyAdminSession()`, the caller's JWT is validated via `supabase.auth.getUser()`, followed by an authoritative profile query.
- **Route Guarding**:
  - `CitizenRoute` halts navigation for unauthenticated callers and redirects to `/login`.
  - `AdminRoute` validates both authentication and `profile.role === 'admin'`. Non-administrative authenticated citizens are displayed an explicit HTTP 403-equivalent denial component (`Municipal Officer Authorization Required`) and prevented from viewing administrative queues.
- **Session Teardown**: `signOut()` invokes `supabase.auth.signOut()` and purges local profile state, tokens, and active subscriptions.

### 3.2 Role Escalation Prevention
1. **Self-Registration Constraint**: In `public.profiles`, the table CHECK constraint enforces `role IN ('citizen', 'admin')`. The INSERT RLS policy enforces `auth.uid() = id AND (role = 'citizen' OR public.is_admin())`.
2. **Database Trigger Enforcement**: The `trigger_enforce_profile_role` trigger executes `BEFORE INSERT OR UPDATE ON public.profiles`. If the caller is not an existing verified administrator or executing within an explicit provisioning transaction, `NEW.role := 'citizen'` on INSERT, and `NEW.role := OLD.role` on UPDATE.
3. **Privileged Function Security**: The administrative provisioning function `public.provision_admin()` is a `SECURITY DEFINER` function with explicit `search_path`. Execution is **revoked from `PUBLIC`, `anon`, and `authenticated`**, and granted strictly to `postgres` (SQL Editor) and `service_role`.

---

## 4. Authorization & Row Level Security (RLS) Audit

Every table in the `public` schema has Row Level Security enabled. A comprehensive audit of all policies was conducted:

| Table | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`public.profiles`** | `auth.uid() = id OR is_admin()` | `auth.uid() = id AND (role = 'citizen' OR is_admin())` | `(auth.uid() = id AND role = 'citizen') OR is_admin()` | Denied (No policy) | **Verified** |
| **`public.complaints`** | `citizen_id = auth.uid() OR is_admin()` | `citizen_id = auth.uid()` | `is_admin()` only | `is_admin() OR (citizen_id = auth.uid() AND status = 'submitted')` | **Verified** |
| **`public.complaint_evidence`** | Linked complaint owner or admin | Linked complaint owner or admin | Denied (No policy; immutable) | Linked complaint owner or admin | **Verified** |
| **`public.ai_assessments`** | Linked complaint owner or admin | `is_admin()` or service-role | `is_admin()` or service-role | `is_admin()` or service-role | **Verified** |
| **`public.complaint_status_history`**| Linked complaint owner or admin | `is_admin()` only | Denied (No policy; immutable audit) | Denied (No policy; non-deletable) | **Verified** |
| **`public.admin_actions`** | `is_admin()` only | `is_admin()` only | `is_admin()` only | `is_admin()` only | **Verified** |
| **`public.complaint_duplicates`** | Linked complaint owner (either A or B) | `is_admin()` only | `is_admin()` only | `is_admin()` only | **Verified** |
| **`public.notifications`** | `auth.uid() = user_id` or admin | Trigger or admin only | `auth.uid() = user_id` (Trigger locks to `read_at`) | `is_admin()` only | **Verified** |

### Blanket Policy Scan Result
- `USING (true)` count across schema and migrations: **0**
- `WITH CHECK (true)` count across schema and migrations: **0**

---

## 5. Storage Security & Private Evidence Management

### 5.1 Bucket Configuration
- **Bucket Identifier**: `complaint-evidence`
- **Visibility**: `public: false` (strictly private). Direct unauthenticated HTTP downloads return 400/403.
- **Allowed MIME Types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`. Enforced both in client validation and bucket definition.
- **Maximum File Size**: 10 MB (`10485760` bytes).

### 5.2 Storage Access Policies (`storage.objects`)
- **SELECT**: Restricted to authenticated users who own the linked complaint or possess the `admin` role. Evaluated by matching the object prefix: `split_part(name, '/', 1) = 'complaints' AND EXISTS (SELECT 1 FROM complaints WHERE id::text = split_part(name, '/', 2) AND citizen_id = auth.uid())`.
- **INSERT**: Enforces path segmentation. Citizens can upload only into `complaints/{complaint_id}/` where `citizen_id = auth.uid()`.
- **UPDATE**: **No update policy exists**. File overwrites are strictly disallowed (`upsert: false` is hardcoded).
- **DELETE**: Restricted to complaint owners (during submission compensation rollback) and administrators.

### 5.3 Path Traversal Sanitization
Storage paths are generated via `generateEvidenceStoragePath()`:
- `complaintId` is validated and sanitized against `/[^a-zA-Z0-9-]/g`.
- `filename` is sanitized against `/\.\./g` (stripping consecutive relative traversal dots) and `/[^a-zA-Z0-9._-]/g`.
- A collision-resistant `crypto.randomUUID()` prefix is prepended to ensure unique object names.

---

## 6. AI Multimodal Inference Security & Edge Function Boundary

### 6.1 Server-Side Isolation
- The Gemini API key (`GEMINI_API_KEY`) is stored strictly within Supabase Edge Function secrets (`supabase secrets set GEMINI_API_KEY=...`).
- There are **zero** `VITE_*_API_KEY` variables in client-side code, configuration, or environment files.
- The Edge Function `analyze-complaint-evidence` verifies caller authorization via `supabase.auth.getUser()`. Anonymous callers receive HTTP 401. Non-owners and non-admins receive HTTP 403.

### 6.2 Model Output Validation & Abuse Resistance
Model output is treated as untrusted input and validated via `validateAndSanitizeScores()`:
- **Type Safety**: Verifies output is a valid JSON object.
- **Numeric Bounds**: Every dimension (`severity`, `safety_risk`, `evidence_support`, `image_quality`, `description_match`, `public_impact`) is checked to ensure it is a finite number between `0.00` and `100.00`.
- **Runaway Token Rejection**: Rejects `reasoning_summary` exceeding 2500 characters, `detected_issue` exceeding 500 characters, and `suggested_category` exceeding 200 characters.
- **Independent Safety Rules**: Deterministic municipal triggers override model flags:
  - `image_quality < 40` -> flags human review.
  - `description_match < 40` -> flags human review.
  - `evidence_support < 40` -> flags human review without complaint rejection.
  - `safety_risk >= 80` -> flags expedited human review.
- **No False Claims**: System instructions explicitly prohibit the model from claiming image authenticity verification or GPS/time forensic proof.

---

## 7. Input Validation & Abuse Resistance

| Input Parameter | Validation Rules | Enforced Boundary | Status |
| :--- | :--- | :--- | :--- |
| **Complaint Title** | Non-empty; 1–200 characters; trimmed | Frontend & Service layer | **Verified** |
| **Description** | Non-empty; 10–2500 characters; trimmed | Frontend & Service layer | **Verified** |
| **Category** | Strict municipal whitelist (11 categories) | Frontend & Database CHECK | **Verified** |
| **Sector** | Non-empty; trimmed | Frontend & Service layer | **Verified** |
| **Landmark** | Optional; max 255 characters | Frontend & Service layer | **Verified** |
| **Street Address** | Optional; max 500 characters | Frontend & Service layer | **Verified** |
| **Evidence File** | Max 10 MB; MIME in [JPEG, JPG, PNG, WEBP] | Frontend, Service, Storage | **Verified** |
| **Status Note** | Min 5 chars (when required); max 2000 chars | Status state machine | **Verified** |
| **Priority Override Reason** | Mandatory; 5–2000 characters | Admin triage service | **Verified** |
| **Duplicate Reason** | Mandatory; 5–2000 characters | Duplicate detection service | **Verified** |
| **Notification Title/Message** | Title <= 255 chars; Message <= 2000 chars | Notification service & DB | **Verified** |
| **Query Identifiers** | Sanitized against `/[^a-zA-Z0-9-]/g` | PostgREST query layer | **Verified** |

---

## 8. XSS & Client-Side Markup Security

- **React Architecture**: All user-controlled text (titles, descriptions, citizen names, notes, tracking numbers) is rendered via standard React JSX text nodes (`{complaint.title}`), which automatically escape HTML entities.
- **Static Code Scan**: A repository-wide regex scan verified:
  - Zero instances of `dangerouslySetInnerHTML`.
  - Zero instances of `innerHTML`.
  - Zero instances of `eval()`.
  - Zero instances of `javascript:` URI pseudo-protocols in links or actions.

---

## 9. Error Handling & Information Leakage Prevention

- **Edge Function Error Sanitization**: Unexpected catch-block exceptions in `analyze-complaint-evidence` are scanned for sensitive database error strings (`syntax error`, `pg_`, `auth.`, `password`, `key`, `token`, stack traces). Sensitive strings are replaced with generic error descriptions (`Internal server error during evidence analysis`) to prevent database schema reconnaissance.
- **Frontend Error Boundaries**: Database connection failures and unconfigured states are handled gracefully via diagnostic status objects rather than exposing raw stack traces or internal endpoints.

---

## 10. Auditability & Immutability

1. **Status History (`complaint_status_history`)**: Records `old_status`, `new_status`, `changed_by`, `note`, and `created_at`. No `UPDATE` or `DELETE` RLS policies exist on this table, creating a tamper-resistant append-only audit trail.
2. **Admin Actions (`admin_actions`)**: Records administrative priority overrides, department wing dispatches, and duplicate reviews with officer ID, timestamps, and justifications. Gated exclusively to `public.is_admin()`.
3. **Notification Immutability Trigger (`trg_enforce_notification_read_only`)**: Prevents non-administrators from tampering with notification records. Any attempt to update recipient `user_id`, `title`, `message`, `complaint_id`, `event_key`, or `metadata` raises an immediate PostgreSQL exception.

---

## 11. Concurrency, Race Conditions & Idempotency

- **Tracking Number Generation**: Uses atomic PostgreSQL sequence `public.complaint_tracking_number_seq` via `nextval()`. Unique constraint `tracking_id UNIQUE` on `complaints` ensures no duplicate tracking numbers can be committed under concurrent intake.
- **Duplicate Detection Idempotency**: Table constraints `chk_complaint_pair_order` (`complaint_a_id < complaint_b_id`) and `uq_complaint_pair` (`UNIQUE(complaint_a_id, complaint_b_id)`) ensure that concurrent comparisons of complaints A and B never produce duplicate candidate rows.
- **Notification Idempotency**: Column `event_key TEXT UNIQUE` with `ON CONFLICT (event_key) DO NOTHING` prevents duplicate notification dispatches during repeated status transitions or worker retries.
- **Transactional Rollback on Submission Failure**: In `createComplaint()`, if photographic evidence upload fails or evidence metadata insertion fails, the newly inserted complaint row is cleaned up immediately, preventing orphaned records.

---

## 12. Known Limitations & Unresolved Risks

1. **Client-Side Environment Variables**: Vite client variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are public by design. Security relies entirely on Supabase Row Level Security (RLS). Any remote instance where RLS is inadvertently disabled would expose data.
2. **Supabase Free Tier Rate Limits**: Default Supabase built-in SMTP rate limits (3-4 verification emails/hour) can cause delays during high-volume testing. Production deployment requires custom SMTP provider configuration.
3. **Simulated Transactionality**: Standard Supabase JavaScript client does not support multi-table atomic transactions across REST and Storage. Compensation logic is implemented at the service layer; catastrophic client disconnection during rollback could leave temporary orphaned records until cleaned by a retention job.
4. **Third-Party AI Availability**: If Google Gemini API experiences an outage, multimodal analysis transitions to the safe `failed` state. The grievance remains intact with status `submitted` and requires manual human review.

---

## 13. Manual Supabase Production Verification Checklist

Because remote Supabase instances may not automatically synchronize with local schema changes, execute the following non-destructive verification queries in the **Supabase Dashboard SQL Editor**:

### Checklist Step 1: Verify Core Tables & RLS Status
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
*Expected: All 8 tables (`profiles`, `complaints`, `complaint_evidence`, `ai_assessments`, `complaint_status_history`, `admin_actions`, `complaint_duplicates`, `notifications`) have `rowsecurity = true`.*

### Checklist Step 2: Verify Zero Permissive RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true');
```
*Expected: 0 rows returned.*

### Checklist Step 3: Verify Status CHECK Constraints (Phase 9 & 10)
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.complaints'::regclass
  AND conname = 'complaints_status_check';
```
*Expected: CHECK includes `'duplicate'` along with standard lifecycle statuses.*

### Checklist Step 4: Verify Duplicate Pair Constraints (Phase 10)
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.complaint_duplicates'::regclass;
```
*Expected: Both `chk_complaint_pair_order` and `uq_complaint_pair` exist.*

### Checklist Step 5: Verify Notification Table & Immutability Trigger (Phase 11 & 12)
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.notifications'::regclass;
```
*Expected: `trg_enforce_notification_read_only` is enabled (`tgenabled = 'O'`).*

### Checklist Step 6: Verify Private Storage Bucket Configuration
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'complaint-evidence';
```
*Expected: `public = false`, `file_size_limit = 10485760`, and allowed MIME types match image formats.*

### Checklist Step 7: Verify Admin Provisioning Execution Privileges
```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'provision_admin';
```
*Expected: Granted ONLY to `postgres` and `service_role`; absent from `PUBLIC`, `anon`, and `authenticated`.*

---

## 14. Test Suite Execution Summary

| Suite | Focus Area | Test Count | Result |
| :--- | :--- | :--- | :--- |
| `phase6_tests.mjs` | AI Assessment Data Contracts & Safety Rules | 18 | **18/18 PASS** |
| `phase7_tests.mjs` | Multimodal Inference & Edge Function Contracts | 12 | **12/12 PASS** |
| `phase8_tests.mjs` | Deterministic Priority Engine & Weights | 17 | **17/17 PASS** |
| `phase9_tests.mjs` | Admin Triage & Status State Machine | 16 | **16/16 PASS** |
| `phase9_patch_tests.mjs` | Priority Override Persistence & Separation | 11 | **11/11 PASS** |
| `phase10_tests.mjs` | Advisory Duplicate & Recurrence Detection | 18 | **18/18 PASS** |
| `phase11_tests.mjs` | Citizen Tracking & Notifications | 17 | **17/17 PASS** |
| `phase12_security_tests.mjs` | Security Hardening, RLS & Failure Paths | 28 | **28/28 PASS** |
| **TOTAL** | **Comprehensive Full-Spectrum Test Suite** | **137** | **137/137 PASS** |

### Static Analysis & Build Verification
- **`npm run lint` (`oxlint`)**: 0 warnings, 0 errors across 71 files with 116 active rules.
- **`npm run build` (`tsc -b && vite build`)**: Compiled and bundled with 0 TypeScript errors.
- **`npm audit`**: 0 vulnerabilities found.
