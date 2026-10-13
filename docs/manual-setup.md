# Chandigarh CivicAI — Supabase Manual Setup & Security Guide
**Phase 3: Supabase Database + Storage Foundation (Security Patch v1.1)**

This document outlines the exact manual steps required to set up and configure your Supabase backend for Chandigarh CivicAI, including role escalation safeguards and storage policies.

---

## 1. Create a Supabase Project

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard) and sign in.
2. Click **"New Project"**.
3. Choose an Organization and enter:
   - **Name**: `chandigarh-civicai`
   - **Database Password**: Generate and securely store a strong password.
   - **Region**: Choose the closest region (e.g. `ap-south-1` / Mumbai for India).
   - **Pricing Plan**: Free tier is sufficient for development.
4. Click **"Create new project"** and wait for deployment to complete (~1-2 minutes).

---

## 2. Obtain Project URL and Anon/Publishable Key

1. In your Supabase project dashboard, open the left navigation and click **Project Settings** (gear icon) -> **API** (or **Data API**).
2. Under **Project URL**:
   - Copy the URL (format: `https://<your-project-id>.supabase.co`).
   - This value corresponds to `VITE_SUPABASE_URL`.
3. Under **Project API keys**:
   - Locate the **`anon` `public`** key.
   - Copy this key.
   - This value corresponds to `VITE_SUPABASE_ANON_KEY`.

> [!CAUTION]
> **CRITICAL SECURITY WARNING: NEVER USE THE `service_role` KEY IN THE FRONTEND.**
> - The `service_role` key **bypasses Row Level Security (RLS)** and has full administrative access to your database.
> - Any variable prefixed with `VITE_` is bundled into client-side JavaScript and is visible to anyone inspecting network requests.
> - Only use the `anon` / `public` key in `VITE_SUPABASE_ANON_KEY`.

---

## 3. Apply the SQL Migration & Schema

1. Open your Supabase Project dashboard and navigate to **SQL Editor** in the left sidebar.
2. Click **"New Query"**.
3. Open the file [`supabase/schema.sql`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/supabase/schema.sql) in this repository.
4. Copy the entire contents of `supabase/schema.sql` and paste it into the Supabase SQL Editor.
5. Click **"Run"** (or press Ctrl+Enter).
6. Verify that all 6 tables and storage configurations were created successfully:
   - `public.profiles` (Guarded against self-escalation)
   - `public.complaints`
   - `public.complaint_evidence`
   - `public.ai_assessments` (With numeric 0.00–100.00 score fields)
   - `public.complaint_status_history`
   - `public.admin_actions`
   - `public.provision_admin()` (Hardened administrator bootstrap function)
   - `public.next_complaint_tracking_id()` (Atomic tracking number generator)
   - All foreign keys, CHECK constraints, triggers, and query indexes.
   - Row Level Security (RLS) enabled on all 6 tables.

---

### 3.1 Phase 5 Migration: Atomic Tracking ID & Compensation Policies (For Existing Projects)

If you already applied the Phase 3/4 schema previously, apply the incremental Phase 5 migration:
1. Open Supabase Dashboard -> **SQL Editor** -> **New Query**.
2. Open [`supabase/migrations/20261013010000_phase5_tracking_id_generator.sql`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/supabase/migrations/20261013010000_phase5_tracking_id_generator.sql) and paste its contents:
   ```sql
   -- Create atomic sequence
   CREATE SEQUENCE IF NOT EXISTS public.complaint_tracking_number_seq START WITH 101;

   -- Tracking ID generator function
   CREATE OR REPLACE FUNCTION public.next_complaint_tracking_id()
   RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
   BEGIN
     RETURN 'CHD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.complaint_tracking_number_seq')::text, 5, '0');
   END;
   $$;

   -- Set column default and enforce trigger
   ALTER TABLE public.complaints ALTER COLUMN tracking_id SET DEFAULT public.next_complaint_tracking_id();

   CREATE OR REPLACE FUNCTION public.enforce_complaint_tracking_id()
   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
   BEGIN
     IF NEW.tracking_id IS NULL OR trim(NEW.tracking_id) = '' THEN
       NEW.tracking_id := public.next_complaint_tracking_id();
     END IF;
     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trigger_set_complaint_tracking_id ON public.complaints;
   CREATE TRIGGER trigger_set_complaint_tracking_id BEFORE INSERT ON public.complaints
     FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_tracking_id();

   -- Permissions
   REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM PUBLIC;
   REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM anon;
   GRANT EXECUTE ON FUNCTION public.next_complaint_tracking_id() TO authenticated, service_role, postgres;

   -- Rollback DELETE policies
   DROP POLICY IF EXISTS "Citizens delete own submitted complaints" ON public.complaints;
   CREATE POLICY "Citizens delete own submitted complaints" ON public.complaints
     FOR DELETE TO authenticated USING (public.is_admin() OR (citizen_id = auth.uid() AND status = 'submitted'));

   DROP POLICY IF EXISTS "Citizens delete evidence for own complaints" ON public.complaint_evidence;
   CREATE POLICY "Citizens delete evidence for own complaints" ON public.complaint_evidence
     FOR DELETE TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.citizen_id = auth.uid()));

   DROP POLICY IF EXISTS "Citizens delete evidence for own complaints" ON storage.objects;
   CREATE POLICY "Citizens delete evidence for own complaints" ON storage.objects
     FOR DELETE TO authenticated USING (bucket_id = 'complaint-evidence' AND (public.is_admin() OR (split_part(name, '/', 1) = 'complaints' AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id::text = split_part(name, '/', 2) AND c.citizen_id = auth.uid()))));
   ```
3. Click **"Run"** to execute.

---

## 4. Supabase Auth Configuration & Administrative Account Provisioning

### 4.1 Supabase Auth Provider Configuration (Required in Supabase Dashboard)
1. Open the Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**.
2. Ensure **Email provider** is toggled **ON**.
3. **Confirm email** setting:
   - For rapid hackathon testing/development: You can toggle **"Confirm email" OFF** if you want instant login without waiting for email deliveries, OR leave it **ON** to test the 6-digit email OTP and magic link verification flow.
4. Open **Authentication** -> **URL Configuration**:
   - **Site URL**: Set to `http://localhost:5173` (or `http://127.0.0.1:5173`).
   - **Redirect URLs**: Add `http://localhost:5173/**` and `http://127.0.0.1:5173/**`.
5. Under **Authentication** -> **Rate Limits** / **Email Templates**:
   - Note that Supabase's default built-in SMTP has a delivery limit of 3-4 emails per hour. For production or high-volume testing, configure a custom SMTP provider (Resend, SendGrid, Amazon SES) in **Project Settings** -> **Auth**.

---

### 4.2 Privilege Escalation Safeguard
- Normal self-registration through the client application **unconditionally produces `role = 'citizen'`**.
- The database enforces this via the `trigger_enforce_profile_role` trigger (`BEFORE INSERT OR UPDATE`) and an RLS `WITH CHECK` constraint. Even if an attacker directly calls the Supabase REST API with `role: 'admin'`, the database trigger overrides the role to `'citizen'`.
- Similarly, a citizen cannot update their own role via `UPDATE public.profiles`.

---

### 4.3 Step-by-Step Instructions to Provision the First Demo Administrator

Do NOT hardcode admin credentials in source code or Git. Follow these exact steps to create and promote a verified demo municipal administrator:

1. **Create the Supabase Auth User**:
   - **Option A (Supabase Dashboard)**:
     1. In Supabase Dashboard, navigate to **Authentication** -> **Users**.
     2. Click **"Add user"** -> **"Create user"**.
     3. Enter an official email (e.g., `admin.officer@chandigarh.gov.in`) and a secure password.
     4. Ensure **"Auto Confirm User?"** is checked, then click **"Create user"**.
   - **Option B (Through Web App)**:
     1. Open `http://localhost:5173/register` and register with an email and password.
     2. Complete email verification if enabled.

2. **Obtain the User UUID**:
   - In Supabase Dashboard -> **Authentication** -> **Users**, locate the created user.
   - Copy their **User UID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

3. **Promote the User to Administrator via Privileged Function**:
   - Open **SQL Editor** in Supabase Dashboard and execute the hardened database administrator provisioning function:
     ```sql
     -- Execute the privileged provision_admin SECURITY DEFINER function
     SELECT public.provision_admin(
       '<authorized-user-uuid>'::uuid,
       'Chief Municipal Engineer',
       '+91 98140 00001',
       'Sector 17'
     );
     ```
   - **Why this is secure**:
     - `public.provision_admin` is a hardened `SECURITY DEFINER` function with explicit `search_path`.
     - Execution permissions are **revoked from `PUBLIC`, `anon`, and `authenticated`**. Frontend users and citizens cannot execute it.
     - Only the database administrator (`postgres` in the SQL Editor) or server-side `service_role` can call it.
     - It safely manages the transaction-local provisioning flag so that `trigger_enforce_profile_role` validates and applies `role = 'admin'` without requiring trigger modifications or disabling security checks.
   - Verify that the profile has `role = 'admin'` by running:
     ```sql
     SELECT id, full_name, role FROM public.profiles WHERE id = '<authorized-user-uuid>';
     ```

4. **Sign In to the Administrator Portal**:
   - Open the web application and navigate to `/login`.
   - Select the **"Administrator Login"** tab.
   - Enter the admin email and password.
   - The user will be authenticated and redirected to the **Admin Command Queue** (`/admin/dashboard`).

---

## 5. Verify Private Storage Bucket Configuration

The SQL migration automatically initializes the storage bucket. To verify in the Supabase Dashboard:

1. Open the left sidebar and click **Storage**.
2. Locate the bucket named **`complaint-evidence`**.
3. Verify the configuration:
   - **Public bucket**: **NO (Private)**. Ensure the toggle is OFF. Public access is strictly prohibited.
   - **File size limit**: 10 MB (`10485760` bytes).
   - **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
4. Check **Policies** under the bucket:
   - **Select Policy**: Authenticated users can read evidence objects only if linked to complaints they own (`split_part(name, '/', 1) = 'complaints' AND EXISTS (SELECT 1 FROM complaints WHERE id::text = split_part(name, '/', 2) AND citizen_id = auth.uid())`) or if they have the `admin` role.
   - **Insert Policy**: Authenticated users can upload evidence **only** to storage paths corresponding to complaints they own (`complaints/{complaint_id}/{uuid}-{filename}`). Arbitrary uploads are rejected.

---

## 6. Configure Local Environment Variables

1. In the root of this project, create a `.env.local` file (or copy `.env.example` to `.env.local`):
   ```bash
   cp .env.example .env.local
   ```
2. Populate the required keys with the values obtained from Step 2:
   ```env
   VITE_SUPABASE_URL="https://<your-project-id>.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-publishable-key-here"
   VITE_SUPABASE_EVIDENCE_BUCKET="complaint-evidence"
   ```
3. Save the file.
4. Restart your Vite development server:
   ```bash
   npm run dev
   ```

---

## 7. Optional: Development Seed Data

If you want to populate your staging database with anonymized synthetic complaints for testing:

1. In the Supabase Dashboard, open **SQL Editor**.
2. Copy and paste the contents of [`supabase/seed.sql`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/supabase/seed.sql).
3. Click **"Run"**.
4. This will insert synthetic test complaints (`CHD-TEST-0001`, `CHD-TEST-0002`) linked to mock UUID profiles, with numeric AI assessments.

---

## 8. Phase 11: Notifications & Citizen Tracking Migration

To provision the in-app notification system on your remote Supabase instance:

1. Open the **SQL Editor** in your Supabase Dashboard (`https://supabase.com/dashboard/project/<your-project-id>/sql`).
2. Open [`supabase/migrations/20261013020000_phase11_notifications.sql`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/supabase/migrations/20261013020000_phase11_notifications.sql).
3. Copy and run the script in the SQL Editor.
4. This script executes:
   - Creation of `public.notifications` table with CHECK constraint on `notification_type`.
   - Index optimization on `user_id`, `read_at`, `created_at`, `complaint_id`, and `event_key`.
   - RLS enablement with strict user ownership policies for `SELECT` and `UPDATE` (`auth.uid() = user_id`).
   - `handle_complaint_intake_notification()` trigger (`SECURITY DEFINER`) for automated intake alerts on `public.complaints AFTER INSERT`.

---

## 9. Security & Governance Policies Summary

- **Row Level Security (RLS)**: Enforced unconditionally across all public schema tables.
- **No Blanket Access**: There are **no** `USING (true)` blanket read or write policies.
- **Role Escalation Protection**: Database triggers lock self-registration to `role = 'citizen'`.
- **Aadhaar Exclusion**: No Aadhaar numbers or biometric identities are collected, stored, or processed.
- **Numeric AI Assessment Fields**: `severity`, `safety_risk`, `evidence_support`, `image_quality`, `description_match`, and `public_impact` use `NUMERIC(5, 2)` bounded strictly between `0.00` and `100.00`.
- **Private Storage**: Evidence photographs are stored in a private bucket accessible only via verified complaint ownership RLS or expiring signed URLs.
