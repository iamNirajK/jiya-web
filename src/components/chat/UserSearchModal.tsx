import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { db, collection, getDocs, query, limit } from '../../lib/firebase';
import { UserProfile, CallType } from '../../types';
import { Search, X, MessageSquare, Phone, Video, UserPlus, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserProfile) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const { user: currentUser, isFavorite, toggleFavorite } = useAuth();
  const { startCall } = useCall();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial suggested users
  useEffect(() => {
    if (!isOpen) return;

    const fetchSuggested = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(50));
        const snap = await getDocs(q);
        const list: UserProfile[] = [];

        snap.forEach((doc) => {
          const u = doc.data() as UserProfile;
          if (u.uid !== currentUser?.uid) {
            list.push(u);
          }
        });

        setResults(list);
      } catch (err) {
        console.warn('Fetch users error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggested();
  }, [isOpen, currentUser?.uid]);

  // Filter results on search
  const filteredUsers = results.filter((u) => {
    const term = searchTerm.toLowerCase().trim().replace(/^@/, '');
    if (!term) return true;
    return (
      u.displayName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  const handleStartCall = (targetUser: UserProfile, type: CallType, e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    startCall(targetUser, type);
  };

  const handleToggleFav = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(uid);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm select-none">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md h-[85vh] sm:h-[600px] bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Find People
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name or @username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 px-1">
            Search registered Jiya users to message or start an instant voice/video call.
          </p>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 pt-1 space-y-1.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Finding contacts...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No users found
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Try searching for a different name or @username.
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isFav = isFavorite(u.uid);

              return (
                <div
                  key={u.uid}
                  onClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="relative flex-shrink-0">
                      <img
                        src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.uid}`}
                        alt={u.displayName}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          u.isOnline ? 'bg-green-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {u.displayName}
                        </h3>
                        {isFav && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold truncate">
                        @{u.username}
                      </p>
                      {u.bio && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {u.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => handleToggleFav(u.uid, e)}
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors shadow-xs ${
                        isFav
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500'
                      }`}
                      title={isFav ? 'Remove Favorite' : 'Add to Favorites'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => handleStartCall(u, 'voice', e)}
                      className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors shadow-xs"
                      title="Voice Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleStartCall(u, 'video', e)}
                      className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors shadow-xs"
                      title="Video Call"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        onSelectUser(u);
                        onClose();
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};
