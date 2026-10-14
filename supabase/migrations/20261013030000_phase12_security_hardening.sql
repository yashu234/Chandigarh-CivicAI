-- =============================================================================
-- Chandigarh CivicAI — Phase 12 Migration: Security Hardening & Immutability Trigger
-- Adds enforce_notification_read_only_update trigger to public.notifications
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
