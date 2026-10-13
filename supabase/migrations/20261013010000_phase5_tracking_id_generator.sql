-- =============================================================================
-- Migration: 20261013010000_phase5_tracking_id_generator.sql
-- Description: Concurrency-safe atomic tracking ID generation and citizen rollback policies
-- Jurisdiction: Union Territory of Chandigarh (MCC & UT Engineering)
-- =============================================================================

-- 1. Create a dedicated sequence for complaint tracking numbers
CREATE SEQUENCE IF NOT EXISTS public.complaint_tracking_number_seq START WITH 101;

-- 2. Hardened function to generate human-readable tracking ID (e.g. CHD-2026-00101)
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

-- 3. Set column default on public.complaints
ALTER TABLE public.complaints
  ALTER COLUMN tracking_id SET DEFAULT public.next_complaint_tracking_id();

-- 4. Trigger to guarantee tracking ID is generated if passed as NULL or empty
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

-- 5. Revoke/Grant permissions for generator function
REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_complaint_tracking_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.next_complaint_tracking_id() TO authenticated, service_role, postgres;

-- 6. Safe deletion policies for rollback and compensation
DROP POLICY IF EXISTS "Citizens delete own submitted complaints" ON public.complaints;
CREATE POLICY "Citizens delete own submitted complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    (citizen_id = auth.uid() AND status = 'submitted')
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

-- Storage DELETE policy for evidence rollback
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
