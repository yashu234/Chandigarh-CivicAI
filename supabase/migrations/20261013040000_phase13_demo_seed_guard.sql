-- =============================================================================
-- Chandigarh CivicAI — Phase 13 Migration: Demo Seed Guard
-- Adds a schema-level advisory view that clearly marks demo/synthetic data.
-- This migration is safe to apply to both local dev and remote Supabase.
-- =============================================================================

-- Advisory view: surfaces all complaints marked as demo (tracking_id starts with 'CHD-TEST-')
-- This is READ ONLY and carries no RLS implications.
CREATE OR REPLACE VIEW public.v_demo_complaints AS
  SELECT
    id,
    tracking_id,
    title,
    category,
    sector,
    status,
    priority_tier,
    priority_score,
    created_at,
    'SYNTHETIC_DEMO' AS data_classification
  FROM public.complaints
  WHERE tracking_id LIKE 'CHD-TEST-%';

COMMENT ON VIEW public.v_demo_complaints IS
  'Advisory view exposing only synthetic demo complaints (tracking_id prefix CHD-TEST-). '
  'Do not join this view in production citizen-facing queries. '
  'All rows here are created by the demo seed script and contain no real citizen data.';

-- Advisory notice function — call this in SQL console to verify demo state
CREATE OR REPLACE FUNCTION public.demo_readiness_check()
RETURNS TABLE (
  check_name TEXT,
  status     TEXT,
  detail     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check 1: RLS enabled on all core tables
  RETURN QUERY
    SELECT
      'RLS enabled on all core tables'::TEXT,
      CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'WARN' END::TEXT,
      ('Tables with RLS: ' || COUNT(*)::TEXT || '/8')::TEXT
    FROM pg_class pc
    JOIN pg_namespace pn ON pc.relnamespace = pn.oid
    WHERE pn.nspname = 'public'
      AND pc.relname IN (
        'profiles','complaints','complaint_evidence',
        'ai_assessments','complaint_status_history','admin_actions',
        'complaint_duplicates','notifications'
      )
      AND pc.relrowsecurity = true;

  -- Check 2: Demo data present
  RETURN QUERY
    SELECT
      'Demo seed data present'::TEXT,
      CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'WARN' END::TEXT,
      ('Demo complaints found: ' || COUNT(*)::TEXT)::TEXT
    FROM public.complaints
    WHERE tracking_id LIKE 'CHD-TEST-%';

  -- Check 3: No USING(true)/WITH CHECK(true) policies (overly permissive)
  RETURN QUERY
    SELECT
      'No permissive wildcard RLS policies'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
      ('Permissive USING(true)/WITH CHECK(true) policies: ' || COUNT(*)::TEXT)::TEXT
    FROM pg_policies
    WHERE (qual = 'true' OR with_check = 'true');

  -- Check 4: Tracking sequence initialized
  RETURN QUERY
    SELECT
      'Complaint tracking sequence initialized'::TEXT,
      CASE WHEN last_value >= 101 THEN 'PASS' ELSE 'WARN' END::TEXT,
      ('Sequence last_value: ' || last_value::TEXT)::TEXT
    FROM public.complaint_tracking_number_seq;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.demo_readiness_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.demo_readiness_check() FROM anon;
GRANT EXECUTE ON FUNCTION public.demo_readiness_check() TO service_role, postgres;

COMMENT ON FUNCTION public.demo_readiness_check() IS
  'Phase 13 readiness check. Run as admin/postgres to verify RLS status, '
  'demo seed presence, and absence of permissive policies before a demo session.';
