'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, acceptTripInvitation, rejectTripInvitation } from '@/lib/api';
import type { Notification } from '@tripmatrix/types';
import { MdHome, MdArrowBack, MdCheckCircle, MdClose, MdNotifications, MdNotificationsNone } from 'react-icons/md';

export default function NotificationsPage() {
  const { user, getIdToken } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const data = await getNotifications(token);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = await getIdToken();
      await markNotificationAsRead(notificationId, token);
      setNotifications(prev =>
        prev.map(n => n.notificationId === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await getIdToken();
      await markAllNotificationsAsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleAcceptInvitation = async (notification: Notification) => {
    try {
      const token = await getIdToken();
      await acceptTripInvitation(notification.notificationId, token);
      await handleMarkAsRead(notification.notificationId);
      // Reload notifications
      loadNotifications();
      // Navigate to trip if available
      if (notification.tripId) {
        router.push(`/trips/${notification.tripId}`);
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      alert('Failed to accept invitation');
    }
  };

  const handleRejectInvitation = async (notification: Notification) => {
    try {
      const token = await getIdToken();
      await rejectTripInvitation(notification.notificationId, token);
      await handleMarkAsRead(notification.notificationId);
      // Reload notifications
      loadNotifications();
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      alert('Failed to reject invitation');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white">
              <MdArrowBack className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-semibold text-white">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-500 text-sm font-medium hover:opacity-70"
            >
              Mark all read
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[600px] mx-auto pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdNotificationsNone className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.notificationId}
                className={`px-4 py-3 border-b border-gray-800 ${
                  !notification.isRead ? 'bg-gray-900' : 'bg-black'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm mb-1">
                      {notification.title}
                    </p>
                    <p className="text-gray-400 text-sm mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-xs" suppressHydrationWarning>
                        {format(toDate(notification.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                      {notification.type === 'trip_invitation' && !notification.isRead && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptInvitation(notification)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all"
                          >
                            <MdCheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectInvitation(notification)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-all"
                          >
                            <MdClose className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                      {notification.tripId && notification.type !== 'trip_invitation' && (
                        <Link
                          href={`/trips/${notification.tripId}`}
                          className="text-blue-500 text-xs hover:underline"
                        >
                          View Trip
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

