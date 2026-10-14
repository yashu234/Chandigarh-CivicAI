import { supabase, isSupabaseConfigured } from '../supabase/client.ts';
import type {
  CivicNotification,
  CreateNotificationParams,
  NotificationFilterOptions,
} from './notificationTypes.ts';
import type { NotificationRow } from '../../types/database.ts';

const LOCAL_STORAGE_NOTIFS_KEY = 'chandigarh_civicai_demo_notifications';

let inMemoryNotifs: CivicNotification[] | null = null;

/**
 * In-memory / localStorage fallback notifications for demo mode & tests
 */
function getLocalDemoNotifications(): CivicNotification[] {
  if (inMemoryNotifs) {
    return inMemoryNotifs;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY);
      if (raw) {
        inMemoryNotifs = JSON.parse(raw);
        return inMemoryNotifs!;
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  // Initial seed demo notifications for Chandigarh citizens
  inMemoryNotifs = [
    {
      id: 'demo-notif-1',
      userId: 'demo-citizen',
      complaintId: 'cmp-001',
      notificationType: 'assigned',
      title: 'Grievance Dispatched to Department',
      message: 'Your grievance CHD-2026-0001 has been assigned to the Roads & Infrastructure wing for field action.',
      readAt: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      metadata: { tracking_id: 'CHD-2026-0001', sector: 'Sector 17' },
      eventKey: 'demo-assign-cmp-001',
      isRead: false,
      trackingNumber: 'CHD-2026-0001',
    },
    {
      id: 'demo-notif-2',
      userId: 'demo-citizen',
      complaintId: 'cmp-002',
      notificationType: 'status_changed',
      title: 'Remediation In Progress',
      message: 'Active physical repairs and field work are underway at Sector 22 regarding CHD-2026-0002.',
      readAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      metadata: { tracking_id: 'CHD-2026-0002', sector: 'Sector 22' },
      eventKey: 'demo-status-cmp-002',
      isRead: true,
      trackingNumber: 'CHD-2026-0002',
    },
  ];

  return inMemoryNotifs;
}

function saveLocalDemoNotifications(notifs: CivicNotification[]): void {
  inMemoryNotifs = notifs;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, JSON.stringify(notifs));
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Maps a database row from public.notifications to the CivicNotification domain model.
 */
function mapRowToNotification(row: NotificationRow): CivicNotification {
  const metadata = (row.metadata as Record<string, unknown>) || {};
  return {
    id: row.id,
    userId: row.user_id,
    complaintId: row.complaint_id,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
    metadata,
    eventKey: row.event_key,
    isRead: Boolean(row.read_at),
    trackingNumber: (metadata.tracking_id as string) || null,
  };
}

/**
 * Fetches notifications for the currently authenticated user.
 * Strictly enforces that citizens can only retrieve their own notifications.
 */
export async function getUserNotifications(
  options?: NotificationFilterOptions
): Promise<{ data: CivicNotification[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    let demoList = getLocalDemoNotifications();
    if (options?.unreadOnly) {
      demoList = demoList.filter((n) => !n.isRead);
    }
    if (options?.limit) {
      demoList = demoList.slice(0, options.limit);
    }
    return { data: demoList, error: null };
  }

  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      // Return empty if not authenticated
      return { data: [], error: null };
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.is('read_at', null);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: rows, error: selectErr } = await query;

    if (selectErr) {
      // If table does not exist yet on remote, fail gracefully with local demo
      if (selectErr.message.includes('relation "public.notifications" does not exist') || selectErr.code === '42P01') {
        console.warn('[notificationService] notifications table not found on remote. Using local fallback.');
        let demoList = getLocalDemoNotifications();
        if (options?.unreadOnly) demoList = demoList.filter((n) => !n.isRead);
        if (options?.limit) demoList = demoList.slice(0, options.limit);
        return { data: demoList, error: null };
      }
      return { data: [], error: selectErr };
    }

    const notifications: CivicNotification[] = (rows || []).map(mapRowToNotification);
    return { data: notifications, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches count of unread notifications for current authenticated user.
 */
export async function getUnreadNotificationCount(): Promise<{ count: number; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getLocalDemoNotifications();
    return { count: list.filter((n) => !n.isRead).length, error: null };
  }

  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { count: 0, error: null };
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) {
      if (error.message.includes('relation "public.notifications" does not exist') || error.code === '42P01') {
        const list = getLocalDemoNotifications();
        return { count: list.filter((n) => !n.isRead).length, error: null };
      }
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Marks a single notification as read for the current user.
 * Explicitly guards against mutating other citizens' notifications.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getLocalDemoNotifications();
    const target = list.find((n) => n.id === notificationId);
    if (target) {
      target.readAt = new Date().toISOString();
      target.isRead = true;
      saveLocalDemoNotifications(list);
    }
    return { success: true, error: null };
  }

  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      throw new Error('Authentication required to update notification read state.');
    }

    const { error: updateErr } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id); // Strict ownership check

    if (updateErr) {
      if (updateErr.message.includes('relation "public.notifications" does not exist') || updateErr.code === '42P01') {
        const list = getLocalDemoNotifications();
        const target = list.find((n) => n.id === notificationId);
        if (target) {
          target.readAt = new Date().toISOString();
          target.isRead = true;
          saveLocalDemoNotifications(list);
        }
        return { success: true, error: null };
      }
      throw updateErr;
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Marks all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const list = getLocalDemoNotifications();
    for (const n of list) {
      n.readAt = new Date().toISOString();
      n.isRead = true;
    }
    saveLocalDemoNotifications(list);
    return { success: true, error: null };
  }

  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      throw new Error('Authentication required.');
    }

    const { error: updateErr } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (updateErr) {
      if (updateErr.message.includes('relation "public.notifications" does not exist') || updateErr.code === '42P01') {
        const list = getLocalDemoNotifications();
        for (const n of list) {
          n.readAt = new Date().toISOString();
          n.isRead = true;
        }
        saveLocalDemoNotifications(list);
        return { success: true, error: null };
      }
      throw updateErr;
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Creates a notification deterministically and idempotently.
 * Enforces event_key uniqueness so repeated calls will NOT duplicate notifications.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<{ success: boolean; id?: string; error: Error | null }> {
  const safeTitle = params.title?.slice(0, 255) || 'Municipal Update';
  const safeMessage = params.message?.slice(0, 2000) || '';

  const eventKey =
    params.eventKey ||
    `${params.notificationType}_${params.complaintId || 'gen'}_${params.metadata?.status || 'event'}`;

  if (!isSupabaseConfigured()) {
    const list = getLocalDemoNotifications();
    const existing = list.find((n) => n.eventKey === eventKey);
    if (!existing) {
      const newNotif: CivicNotification = {
        id: `notif-${Date.now()}`,
        userId: params.userId,
        complaintId: params.complaintId || null,
        notificationType: params.notificationType,
        title: safeTitle,
        message: safeMessage,
        readAt: null,
        createdAt: new Date().toISOString(),
        metadata: params.metadata || {},
        eventKey,
        isRead: false,
        trackingNumber: (params.metadata?.tracking_id as string) || null,
      };
      list.unshift(newNotif);
      saveLocalDemoNotifications(list);
      return { success: true, id: newNotif.id, error: null };
    }
    return { success: true, id: existing.id, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .upsert(
        {
          user_id: params.userId,
          complaint_id: params.complaintId || null,
          notification_type: params.notificationType,
          title: safeTitle,
          message: safeMessage,
          metadata: params.metadata || {},
          event_key: eventKey,
        },
        { onConflict: 'event_key', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      // If table doesn't exist yet on remote, save to local demo storage
      if (error.message.includes('relation "public.notifications" does not exist') || error.code === '42P01') {
        const list = getLocalDemoNotifications();
        const existing = list.find((n) => n.eventKey === eventKey);
        if (!existing) {
          const newNotif: CivicNotification = {
            id: `notif-${Date.now()}`,
            userId: params.userId,
            complaintId: params.complaintId || null,
            notificationType: params.notificationType,
            title: params.title,
            message: params.message,
            readAt: null,
            createdAt: new Date().toISOString(),
            metadata: params.metadata || {},
            eventKey,
            isRead: false,
            trackingNumber: (params.metadata?.tracking_id as string) || null,
          };
          list.unshift(newNotif);
          saveLocalDemoNotifications(list);
          return { success: true, id: newNotif.id, error: null };
        }
        return { success: true, id: existing.id, error: null };
      }
      return { success: false, error };
    }

    return { success: true, id: data?.id, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
