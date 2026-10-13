-- =============================================================================
-- Chandigarh CivicAI — Initial Database Schema & Storage Foundation
-- Phase 3: Supabase Database + Storage Foundation (With Security & Data Model Patches)
-- Jurisdiction: Union Territory of Chandigarh (MCC & UT Engineering)
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
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL, -- e.g. 'CHD-2026-00124'
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
    'rejected'
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
    'rejected'
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

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) HELPER
-- =============================================================================

-- Security Definer function to check if caller has verified admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- CRITICAL SECURITY FIX: ROLE ESCALATION PREVENTION TRIGGER
-- Guarantees that self-registration can NEVER insert role='admin'.
-- Non-admin users cannot promote themselves or alter their role.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If operation is executed by an existing verified admin, allow setting role
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- On self-registration (INSERT): unconditionally force role to 'citizen'
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'citizen';
  -- On profile update (UPDATE): prevent non-admins from changing role
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
