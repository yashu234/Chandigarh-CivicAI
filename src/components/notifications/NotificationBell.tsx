import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notifications/notificationService';
import type { CivicNotification } from '../../services/notifications/notificationTypes';
import { ROUTES } from '../../constants';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<CivicNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchCount = () => {
      getUnreadNotificationCount().then(({ count }) => {
        if (isMounted) {
          setUnreadCount(count);
        }
      });
    };

    fetchCount();
    const interval = setInterval(fetchCount, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setIsLoading(true);
      getUserNotifications({ limit: 15 }).then(({ data }) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.isRead).length);
        setIsLoading(false);
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: CivicNotification) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    setIsOpen(false);

    if (notif.complaintId || notif.trackingNumber) {
      navigate(ROUTES.COMPLAINT_DETAILS(notif.complaintId || notif.trackingNumber || ''));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  const handleSingleMarkRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />;
      case 'assigned':
        return <Share2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />;
      case 'duplicate_confirmed':
        return <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />;
      default:
        return <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-blue-600 rounded-full border-2 border-white shadow-xs animate-in fade-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin mx-auto mb-2" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-500">
                <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">No Notifications</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  You will receive real-time notifications here as your grievances progress through municipal stages.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                    !notif.isRead
                      ? 'bg-blue-50/50 border-l-3 border-l-blue-600'
                      : 'bg-white text-slate-700'
                  }`}
                >
                  {getNotificationIcon(notif.notificationType)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4
                        className={`text-xs truncate ${
                          !notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleSingleMarkRead(e, notif.id)}
                          title="Mark as read"
                          className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {notif.trackingNumber && (
                        <span className="inline-flex items-center gap-0.5 font-mono font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          <ExternalLink className="h-2.5 w-2.5" />
                          {notif.trackingNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 font-medium">
              Informational notifications • Deterministic triage
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
