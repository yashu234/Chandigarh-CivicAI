-- =============================================================================
-- Chandigarh CivicAI — Complete Consolidated Database Schema & Storage Setup
-- Phase 3: Supabase Database + Storage Foundation (With Security & Data Model Patches)
--
-- Instructions:
-- 1. Open your Supabase Project: https://supabase.com/dashboard/project/<your-project-id>
-- 2. Navigate to SQL Editor -> New Query.
-- 3. Copy and paste the entire contents of this file and click "Run".
-- =============================================================================

-- Enable required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLE: profiles
-- Linked directly to auth.users. Stores citizen & municipal administrator profiles.
-- NOTE: Never stores Aadhaar or protected sensitive attributes.
-- Role assignment is strictly locked to 'citizen' upon self-registration.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile_number TEXT,
  sector TEXT,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 2. TABLE: complaints
-- Core civic grievances with location, status, and explainable priority scores.
-- =============================================================================

-- Sequence for atomic, collision-safe tracking numbers (CHD-YYYY-NNNNN)
CREATE SEQUENCE IF NOT EXISTS public.complaint_tracking_number_seq START WITH 101;

-- Function to generate human-readable tracking ID
CREATE OR REPLACE FUNCTION public.next_complaint_tracking_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN 'CHD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.complaint_tracking_number_seq')::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.next_complaint_tracking_id() TO authenticated, service_role, postgres;

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL DEFAULT public.next_complaint_tracking_id(), -- e.g. 'CHD-2026-00124'
  citizen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Pothole / Road Hazard',
    'Water Supply / Pipeline Leak',
    'Sewage Overflow / Clogged Drain',
    'Garbage Dumping / Sanitation',
    'Non-Functional Streetlight',
    'Exposed Electrical Wire / Pole Damage',
    'Fallen Tree / Hazardous Branches',
    'Encroachment / Public Obstruction',
    'Damaged Public Property / Signage',
    'Stray Cattle / Animal Hazard',
    'Other Civic Grievance'
  )),
  sector TEXT NOT NULL, -- e.g. 'Sector 17', 'Sector 22'
  landmark TEXT,
  street_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
    'rejected',
    'duplicate'
  )),
  priority_tier TEXT NOT NULL DEFAULT 'medium' CHECK (priority_tier IN (
    'critical',
    'high',
    'medium',
    'low'
  )),
  priority_score NUMERIC(5, 2) CHECK (priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ
);

-- =============================================================================
-- 3. TABLE: complaint_evidence
-- Photographic evidence metadata linked to private storage files.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Format: complaints/{complaint_id}/{uuid}-{filename}
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 4. TABLE: ai_assessments
-- Multimodal analysis outputs generated to assist human administrators.
-- Numeric scores (0.00 to 100.00) enforce strict mathematical bounds.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  detected_issue TEXT,
  suggested_category TEXT,
  severity NUMERIC(5, 2) CHECK (severity IS NULL OR (severity >= 0 AND severity <= 100)),
  safety_risk NUMERIC(5, 2) CHECK (safety_risk IS NULL OR (safety_risk >= 0 AND safety_risk <= 100)),
  evidence_support NUMERIC(5, 2) CHECK (evidence_support IS NULL OR (evidence_support >= 0 AND evidence_support <= 100)),
  image_quality NUMERIC(5, 2) CHECK (image_quality IS NULL OR (image_quality >= 0 AND image_quality <= 100)),
  description_match NUMERIC(5, 2) CHECK (description_match IS NULL OR (description_match >= 0 AND description_match <= 100)),
  public_impact NUMERIC(5, 2) CHECK (public_impact IS NULL OR (public_impact >= 0 AND public_impact <= 100)),
  reasoning_summary TEXT,
  human_review_required BOOLEAN NOT NULL DEFAULT false,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 5. TABLE: complaint_status_history
-- Audit log of status transitions across municipal remediation stages.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN (
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
    'rejected',
    'duplicate'
  )),
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 6. TABLE: admin_actions
-- Accountability and audit log of departmental actions and priority overrides.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- e.g. 'assign_department', 'priority_override', 'add_note'
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 7. TABLE: complaint_duplicates
-- Advisory duplicate candidate registry with canonical pair ordering.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_a_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  complaint_b_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,2) NOT NULL CHECK (similarity_score >= 0.00 AND similarity_score <= 100.00),
  status TEXT NOT NULL CHECK (status IN ('suggested', 'dismissed', 'confirmed_duplicate')) DEFAULT 'suggested',
  matching_signals JSONB NOT NULL,
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Guarantee canonical ordering so (A, B) and (B, A) normalize to one row, and A != B
  CONSTRAINT chk_complaint_pair_order CHECK (complaint_a_id < complaint_b_id),
  CONSTRAINT uq_complaint_pair UNIQUE (complaint_a_id, complaint_b_id)
);

-- =============================================================================
-- 8. TABLE: notifications
-- Citizen in-app tracking notifications with idempotent event keys.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'complaint_submitted',
    'status_changed',
    'assigned',
    'resolved',
    'duplicate_confirmed',
    'municipal_update'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_key TEXT UNIQUE
);

-- =============================================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id ON public.complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority_tier ON public.complaints(priority_tier);
CREATE INDEX IF NOT EXISTS idx_complaints_priority_score ON public.complaints(priority_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_sector ON public.complaints(sector);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_tracking_id ON public.complaints(tracking_id);

CREATE INDEX IF NOT EXISTS idx_evidence_complaint_id ON public.complaint_evidence(complaint_id);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_complaint_id ON public.ai_assessments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_complaint_id ON public.admin_actions(complaint_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_a ON public.complaint_duplicates(complaint_a_id);
CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_b ON public.complaint_duplicates(complaint_b_id);
CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_status ON public.complaint_duplicates(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint_id ON public.notifications(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_key ON public.notifications(event_key);

-- =============================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_complaints_updated_at ON public.complaints;
CREATE TRIGGER set_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_complaint_duplicates_updated_at ON public.complaint_duplicates;
CREATE TRIGGER set_complaint_duplicates_updated_at
  BEFORE UPDATE ON public.complaint_duplicates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatic Tracking ID trigger function for public.complaints
CREATE OR REPLACE FUNCTION public.enforce_complaint_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR trim(NEW.tracking_id) = '' THEN
    NEW.tracking_id := public.next_complaint_tracking_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_complaint_tracking_id ON public.complaints;
CREATE TRIGGER trigger_set_complaint_tracking_id
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_complaint_tracking_id();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) HELPER & ADMIN PROVISIONING
-- =============================================================================

-- Security Definer function to check if caller has verified admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If there is no authenticated session, user is not admin
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Grant execution to authenticated users, service_role, and postgres; revoke from anon and PUBLIC
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, postgres;

-- =============================================================================
-- PRIVILEGED ADMIN BOOTSTRAP FUNCTION
-- Allows authorized database administrator to provision or promote the first
-- administrative officer from the Supabase SQL Editor.
-- Callable ONLY by postgres (SQL Editor) and service_role.
-- Strictly blocked from anon and authenticated frontend callers.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.provision_admin(
  target_user_id UUID,
  full_name TEXT,
  mobile_number TEXT DEFAULT NULL,
  sector TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_profile public.profiles;
BEGIN
  -- Validate target user ID
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id cannot be null';
  END IF;

  -- Ensure full name is provided
  IF full_name IS NULL OR trim(full_name) = '' THEN
    RAISE EXCEPTION 'full_name must be provided for administrator profile';
  END IF;

  -- Verify that target user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = target_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Target user ID % does not exist in auth.users. Create the auth user first.', target_user_id;
  END IF;

  -- Set transaction-local provisioning flag
  PERFORM set_config('app.provisioning_admin', 'true', true);

  -- Upsert profile with verified admin role
  INSERT INTO public.profiles (id, full_name, mobile_number, sector, role, created_at, updated_at)
  VALUES (
    target_user_id,
    trim(full_name),
    mobile_number,
    COALESCE(sector, 'Sector 17'),
    'admin',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      full_name = EXCLUDED.full_name,
      mobile_number = COALESCE(EXCLUDED.mobile_number, public.profiles.mobile_number),
      sector = COALESCE(EXCLUDED.sector, public.profiles.sector),
      updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_profile;

  -- Reset transaction-local provisioning flag
  PERFORM set_config('app.provisioning_admin', 'false', true);

  RETURN v_profile;
END;
$$;

-- Revoke all execution permissions from public and untrusted client roles
REVOKE ALL ON FUNCTION public.provision_admin(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_admin(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.provision_admin(UUID, TEXT, TEXT, TEXT) FROM authenticated;

-- Grant execution strictly to database administrator and service role
GRANT EXECUTE ON FUNCTION public.provision_admin(UUID, TEXT, TEXT, TEXT) TO postgres, service_role;

-- =============================================================================
-- CRITICAL SECURITY FIX: ROLE ESCALATION PREVENTION TRIGGER
-- Guarantees that self-registration can NEVER insert role='admin'.
-- Non-admin users cannot promote themselves or alter their role.
-- Supports legitimate administrator provisioning via provision_admin or SQL Editor.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Allow if explicit administrative provisioning flag is active within this transaction
  IF current_setting('app.provisioning_admin', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 2. Allow if executed directly by database administrator in SQL Editor / direct psql (superuser session without JWT)
  IF session_user = 'postgres' AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Allow if operation is executed by an existing verified admin user via authenticated session
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 4. Otherwise: normal citizen self-service rules apply unconditionally
  -- On self-registration (INSERT): force role strictly to 'citizen'
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'citizen';
  -- On profile update (UPDATE): prevent non-admins from changing their role
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_profile_role ON public.profiles;
CREATE TRIGGER trigger_enforce_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role();

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL APPLICATION TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_duplicates ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Policies for: profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admins read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile or admins update" ON public.profiles;
CREATE POLICY "Users can update own profile or admins update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK ((auth.uid() = id AND role = 'citizen') OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile upon registration" ON public.profiles;
CREATE POLICY "Users can insert own profile upon registration"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id AND (role = 'citizen' OR public.is_admin())
  );

-- -----------------------------------------------------------------------------
-- Policies for: complaints
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Citizens read own complaints or admins read all" ON public.complaints;
CREATE POLICY "Citizens read own complaints or admins read all"
  ON public.complaints FOR SELECT
  TO authenticated
  USING (citizen_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Citizens can create own complaints" ON public.complaints;
CREATE POLICY "Citizens can create own complaints"
  ON public.complaints FOR INSERT
  TO authenticated
  WITH CHECK (citizen_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints"
  ON public.complaints FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Citizens delete own submitted complaints" ON public.complaints;
CREATE POLICY "Citizens delete own submitted complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    (citizen_id = auth.uid() AND status = 'submitted')
  );

-- -----------------------------------------------------------------------------
-- Policies for: complaint_evidence
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read evidence belonging to own complaints or admin" ON public.complaint_evidence;
CREATE POLICY "Read evidence belonging to own complaints or admin"
  ON public.complaint_evidence FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Citizens insert evidence for own complaints" ON public.complaint_evidence;
CREATE POLICY "Citizens insert evidence for own complaints"
  ON public.complaint_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Citizens delete evidence for own complaints" ON public.complaint_evidence;
CREATE POLICY "Citizens delete evidence for own complaints"
  ON public.complaint_evidence FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Policies for: ai_assessments
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read AI assessments for own complaints or admin" ON public.ai_assessments;
CREATE POLICY "Read AI assessments for own complaints or admin"
  ON public.ai_assessments FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins or service role manage AI assessments" ON public.ai_assessments;
CREATE POLICY "Admins or service role manage AI assessments"
  ON public.ai_assessments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Policies for: complaint_status_history
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read status history for own complaints or admin" ON public.complaint_status_history;
CREATE POLICY "Read status history for own complaints or admin"
  ON public.complaint_status_history FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins insert status history records" ON public.complaint_status_history;
CREATE POLICY "Admins insert status history records"
  ON public.complaint_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Policies for: admin_actions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins only access audit actions" ON public.admin_actions;
CREATE POLICY "Admins only access audit actions"
  ON public.admin_actions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Policies for: complaint_duplicates
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage duplicate suggestions" ON public.complaint_duplicates;
CREATE POLICY "Admins manage duplicate suggestions"
  ON public.complaint_duplicates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Citizens view duplicate status of own complaints" ON public.complaint_duplicates;
CREATE POLICY "Citizens view duplicate status of own complaints"
  ON public.complaint_duplicates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE (c.id = complaint_a_id OR c.id = complaint_b_id)
        AND c.citizen_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Policies for: notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all notifications" ON public.notifications;
CREATE POLICY "Admins manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Citizens view own notifications" ON public.notifications;
CREATE POLICY "Citizens view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Citizens update own notification read status" ON public.notifications;
CREATE POLICY "Citizens update own notification read status"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly NO citizen INSERT or DELETE policies on notifications.
-- Creation happens through admin operations or the trusted SECURITY DEFINER trigger below.

-- =============================================================================
-- NOTIFICATION IMMUTABILITY TRIGGER (PHASE 12 SECURITY HARDENING)
-- Guarantees that citizens cannot alter or tamper with administrative notification
-- title, message, notification_type, complaint_id, metadata, or recipient user_id.
-- Citizens may ONLY toggle or update the read_at timestamp.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_notification_read_only_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow full updates if caller is verified admin or postgres/service_role
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- For regular citizens: only read_at may be changed
  IF NEW.user_id <> OLD.user_id OR
     NEW.notification_type <> OLD.notification_type OR
     NEW.title <> OLD.title OR
     NEW.message <> OLD.message OR
     NEW.complaint_id IS DISTINCT FROM OLD.complaint_id OR
     NEW.event_key IS DISTINCT FROM OLD.event_key OR
     NEW.created_at <> OLD.created_at OR
     NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION 'Citizens are permitted only to update read_at on notifications.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_notification_read_only ON public.notifications;
CREATE TRIGGER trg_enforce_notification_read_only
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_notification_read_only_update();

CREATE OR REPLACE FUNCTION public.handle_complaint_intake_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    complaint_id,
    notification_type,
    title,
    message,
    metadata,
    event_key
  )
  VALUES (
    NEW.citizen_id,
    NEW.id,
    'complaint_submitted',
    'Grievance Registered (' || COALESCE(NEW.tracking_id, 'Intake') || ')',
    'Your civic grievance "' || NEW.title || '" has been registered and queued for municipal review.',
    jsonb_build_object(
      'tracking_id', NEW.tracking_id,
      'sector', NEW.sector,
      'category', NEW.category
    ),
    'intake_' || NEW.id::text
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_intake_notification ON public.complaints;
CREATE TRIGGER trg_complaint_intake_notification
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_complaint_intake_notification();

-- =============================================================================
-- SUPABASE STORAGE BUCKET: complaint-evidence (PRIVATE BUCKET)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-evidence',
  'complaint-evidence',
  false, -- STRICTLY PRIVATE BUCKET: Public access is prohibited
  10485760, -- 10MB file limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policy 1: Authenticated users can read evidence of their complaints or if admin
DROP POLICY IF EXISTS "Authenticated users read complaint evidence" ON storage.objects;
CREATE POLICY "Authenticated users read complaint evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'complaint-evidence' AND (
      public.is_admin() OR (
        split_part(name, '/', 1) = 'complaints' AND
        EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id::text = split_part(name, '/', 2)
            AND c.citizen_id = auth.uid()
        )
      )
    )
  );

-- Storage Policy 2: Authenticated citizens can upload ONLY to complaints they own
DROP POLICY IF EXISTS "Authenticated citizens upload complaint evidence" ON storage.objects;
DROP POLICY IF EXISTS "Citizens upload evidence for own complaints" ON storage.objects;
CREATE POLICY "Citizens upload evidence for own complaints"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-evidence' AND (
      public.is_admin() OR (
        split_part(name, '/', 1) = 'complaints' AND
        EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id::text = split_part(name, '/', 2)
            AND c.citizen_id = auth.uid()
        )
      )
    )
  );

-- Storage Policy 3: Authenticated citizens can delete evidence of complaints they own (supports compensation rollback)
DROP POLICY IF EXISTS "Citizens delete evidence for own complaints" ON storage.objects;
CREATE POLICY "Citizens delete evidence for own complaints"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'complaint-evidence' AND (
      public.is_admin() OR (
        split_part(name, '/', 1) = 'complaints' AND
        EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id::text = split_part(name, '/', 2)
            AND c.citizen_id = auth.uid()
        )
      )
    )
  );
