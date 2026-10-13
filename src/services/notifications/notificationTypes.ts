/**
 * Domain types for Phase 11 — Citizen Tracking & In-App Notifications
 */

export type NotificationType =
  | 'complaint_submitted'
  | 'status_changed'
  | 'assigned'
  | 'resolved'
  | 'duplicate_confirmed'
  | 'municipal_update';

export interface CivicNotification {
  id: string;
  userId: string;
  complaintId?: string | null;
  notificationType: NotificationType;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  eventKey?: string | null;
  isRead: boolean;
  trackingNumber?: string | null;
}

export interface CreateNotificationParams {
  userId: string;
  complaintId?: string | null;
  notificationType: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  eventKey?: string;
}

export interface NotificationFilterOptions {
  unreadOnly?: boolean;
  limit?: number;
}
