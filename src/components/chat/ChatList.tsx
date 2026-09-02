import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
} from '../../lib/firebase';
import { Conversation, UserProfile } from '../../types';
import {
  MessageSquare,
  Search,
  Phone,
  Video,
  UserPlus,
  Star,
  Pin,
  PinOff,
  BellOff,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';
import { motion } from 'motion/react';

interface ChatListProps {
  onSelectUser: (user: UserProfile) => void;
  onOpenSearch: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onSelectUser, onOpenSearch }) => {
  const { user, isFavorite, isChatPinned, togglePinChat, isChatMuted } = useAuth();
  const { setUnreadTotal } = useNotifications();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [favoriteUsers, setFavoriteUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch favorite user profiles
  useEffect(() => {
    if (!user?.favorites || user.favorites.length === 0) {
      setFavoriteUsers([]);
      return;
    }

    const fetchFavorites = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('uid', 'in', user.favorites.slice(0, 10))
        );
        const snap = await getDocs(q);
        const list: UserProfile[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as UserProfile);
        });
        setFavoriteUsers(list);
      } catch (e) {
        console.warn('Fetch favorites error:', e);
      }
    };

    fetchFavorites();
  }, [user?.favorites]);

  // Real-time conversations listener
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Conversation[] = [];
        let totalUnread = 0;

        snapshot.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as Conversation;
          list.push(data);
          if (data.unreadCount && data.unreadCount[user.uid]) {
            totalUnread += data.unreadCount[user.uid];
          }
        });

        setConversations(list);
        setUnreadTotal(totalUnread);
        setLoading(false);
      },
      (err) => {
        console.warn('Conversations listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, setUnreadTotal]);

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const now = new Date();
    const date = new Date(ts);
    const isToday =
      now.getDate() === date.getDate() &&
      now.getMonth() === date.getMonth() &&
      now.getFullYear() === date.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getOtherParticipant = (conv: Conversation): UserProfile => {
    const otherUid = conv.participants.find((p) => p !== user?.uid) || '';
    const data = conv.participantData?.[otherUid] || {
      displayName: 'User',
      username: 'user',
      photoURL: '',
    };

    return {
      uid: otherUid,
      displayName: data.displayName || 'Jiya User',
      username: data.username || 'user',
      photoURL: data.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUid}`,
      email: '',
      isOnline: data.isOnline || false,
      lastSeen: data.lastSeen || 0,
      createdAt: 0,
    };
  };

  // Sort conversations: Pinned first, then by updatedAt descending
  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = isChatPinned(a.id) ? 1 : 0;
    const bPinned = isChatPinned(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  // Filter conversations
  const filtered = sortedConversations.filter((conv) => {
    const other = getOtherParticipant(conv);
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      other.displayName.toLowerCase().includes(term) ||
      other.username.toLowerCase().includes(term) ||
      conv.lastMessage?.text?.toLowerCase().includes(term)
    );
  });

  const renderLastMessagePreview = (conv: Conversation) => {
    const lastMsg = conv.lastMessage;
    if (!lastMsg) return 'No messages yet';

    if (lastMsg.type === 'voice_call') {
      return (
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <Phone className="w-3 h-3 inline" /> {lastMsg.text}
        </span>
      );
    }
    if (lastMsg.type === 'video_call') {
      return (
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <Video className="w-3 h-3 inline" /> {lastMsg.text}
        </span>
      );
    }
    if (lastMsg.type === 'voice_message') {
      return (
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <Mic className="w-3 h-3 inline" /> Voice message ({lastMsg.audioDuration || 1}s)
        </span>
      );
    }
    if (lastMsg.type === 'image') {
      return (
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <ImageIcon className="w-3 h-3 inline" /> Photo
        </span>
      );
    }
    return lastMsg.text;
  };

  return (
    <div id="jiya-chat-list" className="w-full pb-24 select-none">
      {/* Quick In-Tab Search bar */}
      <div className="px-4 py-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chats or messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
      </div>

      {/* Favorite Contacts Carousel */}
      {favoriteUsers.length > 0 && !searchTerm && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Favorites</span>
            </div>
            <button
              onClick={onOpenSearch}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {favoriteUsers.map((fav) => (
              <div
                key={fav.uid}
                onClick={() => onSelectUser(fav)}
                className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group active:scale-95 transition-transform"
              >
                <div className="relative">
                  <img
                    src={fav.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fav.uid}`}
                    alt={fav.displayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/80 group-hover:border-amber-500 shadow-sm"
                  />
                  {fav.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 max-w-[56px] truncate text-center">
                  {fav.displayName.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="px-2 space-y-0.5 mt-1">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              No conversations yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6 leading-relaxed">
              Find contacts using search to start direct chatting, voice notes, and calls.
            </p>
            <button
              onClick={onOpenSearch}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-200 dark:shadow-none active:scale-95 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Search People</span>
            </button>
          </div>
        ) : (
          filtered.map((conv) => {
            const other = getOtherParticipant(conv);
            const unread = (user?.uid && conv.unreadCount?.[user.uid]) || 0;
            const isPinned = isChatPinned(conv.id);
            const isMuted = isChatMuted(conv.id);

            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onSelectUser(other)}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border ${
                  isPinned
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100/60 dark:border-indigo-900/40'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-100 dark:hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <img
                      src={other.photoURL}
                      alt={other.displayName}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    {other.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {other.displayName}
                        </h3>
                        {isPinned && (
                          <Pin className="w-3 h-3 text-indigo-600 dark:text-indigo-400 flex-shrink-0 fill-indigo-600" />
                        )}
                        {isMuted && (
                          <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                        {formatTimestamp(conv.updatedAt || conv.lastMessage?.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          unread > 0
                            ? 'font-semibold text-slate-900 dark:text-slate-100'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {renderLastMessagePreview(conv)}
                      </p>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {unread > 0 && (
                          <span className="min-w-[17px] h-[17px] px-1.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                            {unread}
                          </span>
                        )}

                        {/* Quick Pin Toggle Button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChat(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-opacity"
                          title={isPinned ? 'Unpin chat' : 'Pin chat'}
                        >
                          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
