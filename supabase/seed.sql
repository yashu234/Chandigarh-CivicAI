-- =============================================================================
-- Chandigarh CivicAI — Enhanced Demo Seed Data (Phase 13)
-- Replaces / supplements the Phase 3 seed with richer demo scenarios.
--
-- SYNTHETIC DATA ONLY. No real citizen information.
-- All tracking IDs use 'CHD-TEST-' prefix for easy identification.
-- Apply to local Supabase dev or staging. NEVER to production with real users.
-- =============================================================================

DO $$
DECLARE
  citizen1_uuid   UUID := '00000000-0000-0000-0000-000000000001';
  citizen2_uuid   UUID := '00000000-0000-0000-0000-000000000003';
  citizen3_uuid   UUID := '00000000-0000-0000-0000-000000000004';
  admin_uuid      UUID := '00000000-0000-0000-0000-000000000002';

  c1 UUID := '10000000-0000-0000-0000-000000000001';
  c2 UUID := '10000000-0000-0000-0000-000000000002';
  c3 UUID := '10000000-0000-0000-0000-000000000003';
  c4 UUID := '10000000-0000-0000-0000-000000000004';
  c5 UUID := '10000000-0000-0000-0000-000000000005';
  c6 UUID := '10000000-0000-0000-0000-000000000006';
BEGIN

  -- ============================================================
  -- 1. Demo auth users (silently skipped on remote Supabase)
  -- ============================================================
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      (citizen1_uuid, 'demo.citizen1@example.local', '{"full_name":"Demo Citizen Priya"}'::jsonb),
      (citizen2_uuid, 'demo.citizen2@example.local', '{"full_name":"Demo Citizen Rahul"}'::jsonb),
      (citizen3_uuid, 'demo.citizen3@example.local', '{"full_name":"Demo Citizen Sunita"}'::jsonb),
      (admin_uuid,    'demo.admin@example.local',    '{"full_name":"Demo Admin Officer"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ============================================================
  -- 2. Demo profiles
  -- ============================================================
  INSERT INTO public.profiles (id, full_name, mobile_number, sector, role) VALUES
    (citizen1_uuid, 'Demo Citizen Priya',   '+919900000001', 'Sector 17', 'citizen'),
    (citizen2_uuid, 'Demo Citizen Rahul',   '+919900000003', 'Sector 22', 'citizen'),
    (citizen3_uuid, 'Demo Citizen Sunita',  '+919900000004', 'Sector 35', 'citizen'),
    (admin_uuid,    'Demo Admin Officer',   '+919900000002', 'Sector 1',  'admin')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 3. Complaint 1 — CRITICAL: Deep pothole, Sector 17 (RESOLVED)
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c1, 'CHD-TEST-0001', citizen1_uuid,
    '[DEMO] Deep asphalt cavity near Sector 17 roundabout',
    'A large, deep cavity has appeared on the main corridor near the Sector 17 roundabout. '
    'The pothole is approximately 60 cm wide and 15 cm deep, causing vehicles to swerve abruptly. '
    'Risk of motorcycle accidents is severe — especially at night.',
    'Pothole / Road Hazard', 'Sector 17', 'Near Fountain Chowk', '17 D Market Road',
    30.7415, 76.7865,
    'resolved', 'critical', 91.80
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 4. Complaint 2 — HIGH: Water main rupture, Sector 35
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c2, 'CHD-TEST-0002', citizen1_uuid,
    '[DEMO] Potable water main rupture near Sector 35 market',
    'A distribution valve is leaking continuously near the Sector 35 vegetable market entrance. '
    'Significant water loss since 3 days. Road waterlogging is creating pedestrian hazard.',
    'Water Supply / Pipeline Leak', 'Sector 35', 'Near Market Entrance', 'SCO 142 Service Lane',
    30.7258, 76.7642,
    'in_progress', 'high', 83.20
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 5. Complaint 3 — HIGH: Exposed electrical wire, Sector 22
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c3, 'CHD-TEST-0003', citizen2_uuid,
    '[DEMO] Exposed electrical cable on pedestrian footpath, Sector 22',
    'A utility pole near the Sector 22 bus stand has a low-hanging, exposed electrical cable '
    'hanging at head height across the footpath. Children and pedestrians at extreme risk.',
    'Exposed Electrical Wire / Pole Damage', 'Sector 22', 'Near Sector 22 Bus Stand', 'Phase 2 Footpath',
    30.7350, 76.7800,
    'assigned', 'high', 87.50
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 6. Complaint 4 — MEDIUM: Garbage dumping, Sector 22 (near C3 — DUPLICATE candidate)
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c4, 'CHD-TEST-0004', citizen3_uuid,
    '[DEMO] Illegal garbage dumping on Sector 22 footpath',
    'Large mound of construction debris and garbage has been dumped on the Sector 22 footpath '
    'near the bus stand. This is blocking the footpath completely and creating sanitation risk.',
    'Garbage Dumping / Sanitation', 'Sector 22', 'Near Sector 22 Bus Stand', 'Phase 2 Footpath',
    30.7352, 76.7802,
    'under_review', 'medium', 58.40
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 7. Complaint 5 — MEDIUM: Non-functional streetlights, Sector 11
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c5, 'CHD-TEST-0005', citizen2_uuid,
    '[DEMO] Three consecutive streetlights non-functional, Sector 11',
    'Three consecutive street lights on the main road near Sector 11 Government Hospital '
    'have been non-functional for over a week. The road is completely dark at night, '
    'creating safety concerns for late-night workers.',
    'Non-Functional Streetlight', 'Sector 11', 'Near Government Hospital', 'Inner Road North Wing',
    30.7490, 76.7710,
    'submitted', 'medium', 62.10
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 8. Complaint 6 — LOW: Damaged public signage, Sector 8
  -- ============================================================
  INSERT INTO public.complaints (
    id, tracking_id, citizen_id, title, description,
    category, sector, landmark, street_address,
    latitude, longitude, status, priority_tier, priority_score
  ) VALUES (
    c6, 'CHD-TEST-0006', citizen3_uuid,
    '[DEMO] Broken road direction signboard near Sector 8 roundabout',
    'The directional signboard at the Sector 8 roundabout exit toward Sector 9 has fallen and '
    'is lying on the ground. While not immediately dangerous, it may cause confusion.',
    'Damaged Public Property / Signage', 'Sector 8', 'Near Sector 8 Roundabout', 'Main Roundabout Exit',
    30.7600, 76.7750,
    'submitted', 'low', 34.20
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 9. AI Assessments for demo complaints
  -- ============================================================
  INSERT INTO public.ai_assessments (
    complaint_id, detected_issue, suggested_category,
    severity, safety_risk, evidence_support, image_quality,
    description_match, public_impact,
    reasoning_summary, human_review_required, model_version
  ) VALUES
  (
    c1, '[DEMO] Deep road cavity defect', 'Pothole / Road Hazard',
    92.00, 95.00, 94.00, 90.00, 88.00, 85.00,
    '[DEMO ASSESSMENT] Visual evidence strongly supports a deep, wide road cavity with visible structural damage. '
    'High safety risk confirmed by cavity dimensions and location on a primary corridor. '
    'NOTE: This is a synthetic assessment for demonstration purposes only.',
    false, 'civicai-multimodal-v0.1-demo'
  ),
  (
    c2, '[DEMO] Underground pipeline rupture — active leak', 'Water Supply / Pipeline Leak',
    84.00, 78.00, 88.00, 82.00, 92.00, 80.00,
    '[DEMO ASSESSMENT] Photographic evidence shows active waterlogging consistent with pipeline rupture. '
    'Description and visual evidence are strongly correlated. '
    'NOTE: Synthetic assessment for demonstration only.',
    false, 'civicai-multimodal-v0.1-demo'
  ),
  (
    c3, '[DEMO] Exposed live electrical conductor', 'Exposed Electrical Wire / Pole Damage',
    90.00, 97.00, 91.00, 88.00, 94.00, 89.00,
    '[DEMO ASSESSMENT] Evidence strongly supports exposed overhead conductor at pedestrian height. '
    'Extremely high safety risk. Immediate intervention warranted. '
    'NOTE: Synthetic assessment for demonstration only.',
    true, 'civicai-multimodal-v0.1-demo'
  ),
  (
    c5, '[DEMO] Non-functional street lighting — multi-unit', 'Non-Functional Streetlight',
    52.00, 58.00, 65.00, 72.00, 80.00, 60.00,
    '[DEMO ASSESSMENT] Evidence moderately supports streetlight outage pattern. '
    'Moderate risk due to road darkness. Not immediately critical. '
    'NOTE: Synthetic assessment for demonstration only.',
    false, 'civicai-multimodal-v0.1-demo'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 10. Status History for demo complaints
  -- ============================================================
  INSERT INTO public.complaint_status_history (complaint_id, old_status, new_status, changed_by, note) VALUES
    (c1, 'submitted',    'under_review', admin_uuid, '[DEMO] Initial triage. Pothole verified critical severity.'),
    (c1, 'under_review', 'assigned',     admin_uuid, '[DEMO] Assigned to Roads & Bridges dept.'),
    (c1, 'assigned',     'in_progress',  admin_uuid, '[DEMO] Road repair crew dispatched.'),
    (c1, 'in_progress',  'resolved',     admin_uuid, '[DEMO] Pothole patched and road resurfaced. Closed.'),
    (c2, 'submitted',    'under_review', admin_uuid, '[DEMO] Water leak verified by field inspection.'),
    (c2, 'under_review', 'assigned',     admin_uuid, '[DEMO] Assigned to Water Supply & Sanitation dept.'),
    (c2, 'assigned',     'in_progress',  admin_uuid, '[DEMO] Plumbing crew deployed to site.'),
    (c3, 'submitted',    'under_review', admin_uuid, '[DEMO] Electrical hazard escalated to priority review.'),
    (c3, 'under_review', 'assigned',     admin_uuid, '[DEMO] Assigned to Electrical dept for emergency action.')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 11. Demo duplicate candidate pair (C3 ↔ C4 — same location, Sector 22)
  -- ============================================================
  INSERT INTO public.complaint_duplicates (
    complaint_a_id, complaint_b_id, similarity_score, status, matching_signals, review_notes
  ) VALUES (
    c3, c4,
    78.50,
    'suggested',
    '{"location_proximity_m": 28, "sector_match": true, "category_related": true, "landmark_match": true}'::jsonb,
    '[DEMO] Both complaints originate from same Sector 22 Bus Stand footpath within 28m. '
    'Different categories (electrical vs. garbage) but same location cluster.'
  ) ON CONFLICT (complaint_a_id, complaint_b_id) DO NOTHING;

  -- ============================================================
  -- 12. Demo notifications
  -- ============================================================
  INSERT INTO public.notifications (
    user_id, complaint_id, notification_type, title, message, event_key, metadata
  ) VALUES
  (
    citizen1_uuid, c1, 'complaint_submitted',
    '[DEMO] Complaint CHD-TEST-0001 received',
    'Your complaint about the deep pothole near Sector 17 Fountain Chowk has been received. '
    'Tracking ID: CHD-TEST-0001',
    'demo-evt-c1-submitted',
    '{"tracking_id":"CHD-TEST-0001","demo":true}'::jsonb
  ),
  (
    citizen1_uuid, c1, 'resolved',
    '[DEMO] Complaint CHD-TEST-0001 resolved',
    'Great news! The pothole near Sector 17 Fountain Chowk has been repaired. '
    'Work order closed. Thank you for reporting.',
    'demo-evt-c1-resolved',
    '{"tracking_id":"CHD-TEST-0001","demo":true}'::jsonb
  ),
  (
    citizen1_uuid, c2, 'status_changed',
    '[DEMO] Complaint CHD-TEST-0002 is now In Progress',
    'The water main rupture near Sector 35 Market has been assigned to the Water Supply department. '
    'Field crew is on site.',
    'demo-evt-c2-in-progress',
    '{"tracking_id":"CHD-TEST-0002","demo":true}'::jsonb
  ),
  (
    citizen2_uuid, c3, 'assigned',
    '[DEMO] Complaint CHD-TEST-0003 assigned to Electrical Dept',
    'The exposed electrical cable on Sector 22 footpath has been escalated and assigned to '
    'the Electrical Department for emergency action.',
    'demo-evt-c3-assigned',
    '{"tracking_id":"CHD-TEST-0003","demo":true}'::jsonb
  )
  ON CONFLICT (event_key) DO NOTHING;

END $$;
