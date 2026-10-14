-- =============================================================================
-- Chandigarh CivicAI — Phase 9 Migration: Duplicate Status CHECK Constraint
-- Adds 'duplicate' status to complaints and complaint_status_history tables
-- =============================================================================

ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check CHECK (status IN (
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate'
));

ALTER TABLE public.complaint_status_history DROP CONSTRAINT IF EXISTS complaint_status_history_new_status_check;
ALTER TABLE public.complaint_status_history ADD CONSTRAINT complaint_status_history_new_status_check CHECK (new_status IN (
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate'
));
