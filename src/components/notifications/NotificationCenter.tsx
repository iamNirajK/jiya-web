import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { AppNotification, UserProfile } from '../../types';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  PhoneIncoming,
  PhoneMissed,
  Video,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';

interface NotificationCenterProps {
  onSelectUser: (user: UserProfile) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onSelectUser }) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, unreadNotificationCount } =
    useNotifications();
  const { startCall } = useCall();
  const { user } = useAuth();

  const formatTimestamp = (ts: number) => {
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }

    const targetUser: UserProfile = {
      uid: notif.senderId,
      displayName: notif.senderName,
      username: notif.senderName.toLowerCase().replace(/\s+/g, '_'),
      photoURL: notif.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${notif.senderId}`,
      email: '',
      isOnline: false,
      lastSeen: 0,
      createdAt: 0,
    };

    if (notif.type === 'missed_call') {
      startCall(targetUser, 'voice');
    } else {
      onSelectUser(targetUser);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'incoming_voice':
      case 'missed_call':
        return <PhoneMissed className="w-4 h-4 text-red-500" />;
      case 'incoming_video':
        return <Video className="w-4 h-4 text-indigo-500" />;
      case 'message':
      default:
        return <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  return (
    <div id="jiya-notification-center" className="w-full pb-24 px-3">
      {/* Header bar with Mark All as Read */}
      <div className="flex items-center justify-between px-2 py-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Notifications</h2>
          {unreadNotificationCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {unreadNotificationCount} new
            </span>
          )}
        </div>

        {unreadNotificationCount > 0 && (
          <button
            onClick={() => markAllNotificationsAsRead()}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 active:scale-95 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            All caught up!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            You have no pending notifications. When someone sends you a message or calls, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                !notif.read
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/60 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={
                    notif.senderPhoto ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${notif.senderId}`
                  }
                  alt={notif.senderName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  {getIcon(notif.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {notif.title || notif.senderName}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                    {formatTimestamp(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {notif.body}
                </p>
              </div>

              {!notif.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
