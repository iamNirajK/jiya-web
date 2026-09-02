import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useNotifications } from '../../context/NotificationContext';
import { UserProfile } from '../../types';
import { calculateAge } from '../../lib/constants';
import {
  X,
  Phone,
  Video,
  MessageSquare,
  Star,
  Share2,
  Check,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onStartChat: (user: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  onClose,
  onStartChat,
}) => {
  const { isFavorite, toggleFavorite } = useAuth();
  const { startCall } = useCall();
  const { addToast } = useNotifications();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const isFav = isFavorite(user.uid);

  const handleShareProfile = async () => {
    const shareUrl = `${window.location.origin}/user/${user.username}`;
    const shareData = {
      title: `${user.displayName} on Jiya`,
      text: `Connect with ${user.displayName} (@${user.username}) on Jiya!`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      addToast({
        title: 'Link Copied',
        message: `Profile link for @${user.username} copied to clipboard!`,
        type: 'success',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      addToast({
        title: 'Error',
        message: 'Could not copy link to clipboard.',
        type: 'error',
      });
    }
  };

  const formatJoinedDate = (ts?: number) => {
    if (!ts) return 'Recently';
    return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Banner & Avatar */}
          <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 relative flex items-end justify-center">
            <div className="relative -mb-10">
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                alt={user.displayName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-md bg-white dark:bg-slate-800"
              />
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                  user.isOnline ? 'bg-green-500' : 'bg-slate-400'
                }`}
              />
            </div>
          </div>

          {/* User Details */}
          <div className="pt-12 px-5 pb-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {user.displayName}
              </h3>
              {isFav && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
            </div>

            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">
              @{user.username}
            </p>

            {user.bio && (
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto mb-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                {user.bio}
              </p>
            )}

            {/* Age Badge */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
              {user.dateOfBirth && calculateAge(user.dateOfBirth) !== null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200/60 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{calculateAge(user.dateOfBirth)} yrs old</span>
                </span>
              )}
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-4 gap-2 my-4">
              <button
                onClick={() => {
                  onClose();
                  onStartChat(user);
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Message</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  startCall(user, 'voice');
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 active:scale-95 transition-all"
              >
                <Phone className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Voice</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  startCall(user, 'video');
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 active:scale-95 transition-all"
              >
                <Video className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Video</span>
              </button>

              <button
                onClick={() => toggleFavorite(user.uid)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl active:scale-95 transition-all ${
                  isFav
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-semibold">
                  {isFav ? 'Favorited' : 'Favorite'}
                </span>
              </button>
            </div>

            {/* Profile Share & Info */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Joined {formatJoinedDate(user.createdAt)}</span>
              </div>

              <button
                onClick={handleShareProfile}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 active:scale-95 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Share Profile'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
