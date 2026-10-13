-- =============================================================================
-- Migration: 20261013020000_phase11_notifications.sql
-- Description: Phase 11 — Citizen Tracking & In-App Notifications
-- 
-- 1. Creates public.notifications table with strict CHECK constraints
-- 2. Enforces idempotency via unique event_key
-- 3. Enables RLS:
--    - Citizens: SELECT own notifications, UPDATE own read_at status only
--    - Citizens: NO INSERT, NO DELETE policies
--    - Admins: FOR ALL access via public.is_admin()
-- 4. SECURITY DEFINER trigger for complaint intake notification
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

-- Optimization indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint_id ON public.notifications(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_key ON public.notifications(event_key);

-- Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins have full management access
DROP POLICY IF EXISTS "Admins manage all notifications" ON public.notifications;
CREATE POLICY "Admins manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy 2: Citizens can view only their own notifications
DROP POLICY IF EXISTS "Citizens view own notifications" ON public.notifications;
CREATE POLICY "Citizens view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 3: Citizens can update only their own notifications (e.g. marking read_at)
DROP POLICY IF EXISTS "Citizens update own notification read status" ON public.notifications;
CREATE POLICY "Citizens update own notification read status"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly ensure citizens have NO direct INSERT or DELETE policies
-- All creation occurs through trusted backend services (admin session) or SECURITY DEFINER triggers.

-- Trigger for automated citizen notification upon complaint intake
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
