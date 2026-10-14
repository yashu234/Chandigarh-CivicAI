-- =============================================================================
-- Chandigarh CivicAI — Phase 10 Migration: Complaint Duplicates Registry
-- Creates public.complaint_duplicates with canonical ordering, uniqueness, and RLS
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

CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_a ON public.complaint_duplicates(complaint_a_id);
CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_b ON public.complaint_duplicates(complaint_b_id);
CREATE INDEX IF NOT EXISTS idx_complaint_duplicates_status ON public.complaint_duplicates(status);

DROP TRIGGER IF EXISTS set_complaint_duplicates_updated_at ON public.complaint_duplicates;
CREATE TRIGGER set_complaint_duplicates_updated_at
  BEFORE UPDATE ON public.complaint_duplicates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.complaint_duplicates ENABLE ROW LEVEL SECURITY;

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
