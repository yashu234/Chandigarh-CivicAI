-- =============================================================================
-- Chandigarh CivicAI — Development Synthetic Seed Data (OPTIONAL TEST ONLY)
-- Phase 3: Supabase Database + Storage Foundation
--
-- CAUTION:
-- - This script is strictly for local/staging development verification.
-- - Contains only anonymized, synthetic test data.
-- - Never contains real citizens or sensitive personal information.
-- =============================================================================

-- 1. Synthetic Developer User Profiles
-- (Note: In production or local Supabase CLI, IDs match auth.users(id))
-- Using deterministic test UUIDs for reproducible testing:
DO $$
DECLARE
  citizen_uuid UUID := '00000000-0000-0000-0000-000000000001';
  admin_uuid   UUID := '00000000-0000-0000-0000-000000000002';
  complaint_1  UUID := '10000000-0000-0000-0000-000000000001';
  complaint_2  UUID := '10000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert dummy auth users if auth.users table is accessible (e.g. Supabase local dev)
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES
      (citizen_uuid, 'test.citizen@example.local', '{"full_name": "Synthetic Citizen Alpha"}'::jsonb),
      (admin_uuid, 'test.admin@example.local', '{"full_name": "Synthetic Admin Officer"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- In cloud Supabase dashboard where auth.users is restricted, ignore
    NULL;
  END;

  -- 2. Synthetic Profiles
  INSERT INTO public.profiles (id, full_name, mobile_number, sector, role)
  VALUES
    (citizen_uuid, 'Synthetic Citizen Alpha', '+919999900001', 'Sector 17', 'citizen'),
    (admin_uuid, 'Synthetic Admin Officer', '+919999900002', 'Sector 1', 'admin')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Synthetic Complaint 1 (Critical Road Hazard)
  INSERT INTO public.complaints (
    id,
    tracking_id,
    citizen_id,
    title,
    description,
    category,
    sector,
    landmark,
    street_address,
    latitude,
    longitude,
    status,
    priority_tier,
    priority_score
  ) VALUES (
    complaint_1,
    'CHD-TEST-0001',
    citizen_uuid,
    'Synthetic Test: Deep road cavity near crossroad',
    'Simulated test grievance describing deep asphalt crater along corridor.',
    'Pothole / Road Hazard',
    'Sector 17',
    'Near Fountain Square',
    'Inner Ring Plaza',
    30.7415,
    76.7865,
    'under_review',
    'critical',
    91.80
  ) ON CONFLICT (id) DO NOTHING;

  -- 4. Synthetic AI Assessment for Complaint 1
  INSERT INTO public.ai_assessments (
    complaint_id,
    detected_issue,
    suggested_category,
    severity,
    safety_risk,
    evidence_support,
    image_quality,
    description_match,
    public_impact,
    reasoning_summary,
    human_review_required,
    model_version
  ) VALUES (
    complaint_1,
    'Synthetic Detection: Road cavity defect',
    'Pothole / Road Hazard',
    92.00,
    95.00,
    94.00,
    90.00,
    88.00,
    85.00,
    'Demonstration test assessment of synthetic road cavity.',
    false,
    'civicai-multimodal-v0.1-synthetic'
  ) ON CONFLICT (id) DO NOTHING;

  -- 5. Synthetic Complaint 2 (Water Leak)
  INSERT INTO public.complaints (
    id,
    tracking_id,
    citizen_id,
    title,
    description,
    category,
    sector,
    landmark,
    street_address,
    latitude,
    longitude,
    status,
    priority_tier,
    priority_score
  ) VALUES (
    complaint_2,
    'CHD-TEST-0002',
    citizen_uuid,
    'Synthetic Test: Potable water main rupture',
    'Simulated test grievance describing leaking distribution valve.',
    'Water Supply / Pipeline Leak',
    'Sector 35',
    'Near Market Entrance',
    'SCO 142 Service Lane',
    30.7258,
    76.7642,
    'assigned',
    'high',
    83.20
  ) ON CONFLICT (id) DO NOTHING;

  -- 6. Status History Log
  INSERT INTO public.complaint_status_history (
    complaint_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    complaint_1,
    'submitted',
    'under_review',
    admin_uuid,
    'Synthetic initial triage verification.'
  ) ON CONFLICT (id) DO NOTHING;

END $$;
