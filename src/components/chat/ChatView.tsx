import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  db,
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
} from '../../lib/firebase';
import { UserProfile, ChatMessage, Conversation, CallType } from '../../types';
import { triggerPushMessageNotification } from '../../lib/pushClient';
import { MessageBubble } from './MessageBubble';
import { AudioRecorder } from './AudioRecorder';
import { ImageViewerModal } from './ImageViewerModal';
import { UserProfileModal } from '../profile/UserProfileModal';
import {
  ArrowLeft,
  Phone,
  Video,
  Send,
  Mic,
  Image as ImageIcon,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  BellOff,
  Bell,
  Star,
  MoreVertical,
  Shield,
  Smile,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatViewProps {
  otherUser: UserProfile;
  onBack: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ otherUser, onBack }) => {
  const { user, isChatMuted, muteChat, unmuteChat, isFavorite, toggleFavorite } = useAuth();
  const { startCall } = useCall();
  const { addToast } = useNotifications();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(() => {
    return localStorage.getItem(`draft_${otherUser.uid}`) || '';
  });
  const [isOtherTyping, setIsOtherTyping] = useState<boolean | 'typing' | 'recording'>(false);
  const [loading, setLoading] = useState(true);
  const [liveOtherUser, setLiveOtherUser] = useState<UserProfile>(otherUser);

  // In-chat search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Voice recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Image preview state before sending
  const [selectedImageFile, setSelectedImageFile] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isSendingImage, setIsSendingImage] = useState(false);

  // Lightbox full image viewer
  const [viewerImage, setViewerImage] = useState<{ url: string; caption?: string } | null>(null);

  // User Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Header menu popup (Mute duration options)
  const [showMenu, setShowMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const markedReadIdsRef = useRef<Set<string>>(new Set());

  const conversationId = user?.uid
    ? [user.uid, otherUser.uid].sort().join('_')
    : '';

  const isMuted = isChatMuted(conversationId);
  const isFav = isFavorite(otherUser.uid);

  // Format presence text based on privacy settings
  const getPresenceText = () => {
    const privacy = liveOtherUser.privacySettings;
    const canShowOnline = privacy?.onlineStatus !== 'nobody';
    const canShowLastSeen = privacy?.lastSeen !== 'nobody';

    if (isOtherTyping === 'recording') return '🎙️ Recording voice note...';
    if (isOtherTyping === 'typing' || isOtherTyping === true) return 'typing...';

    if (liveOtherUser.isOnline && canShowOnline) return '🟢 Online';
    if (!liveOtherUser.lastSeen || !canShowLastSeen) return 'Offline';

    const diffMin = Math.floor((Date.now() - liveOtherUser.lastSeen) / 60000);
    if (diffMin < 1) return 'Active just now';
    if (diffMin < 60) return `Last seen ${diffMin}m ago`;
    const d = new Date(liveOtherUser.lastSeen);
    return `Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Real-time listener for other user's profile
  useEffect(() => {
    if (!otherUser.uid) return;
    const unsub = onSnapshot(doc(db, 'users', otherUser.uid), (snap) => {
      if (snap.exists()) {
        setLiveOtherUser(snap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [otherUser.uid]);

  // Function to mark all unread messages as read when active
  const markMessagesAsRead = useCallback(
    (messageList: ChatMessage[]) => {
      if (!conversationId || !user?.uid || document.visibilityState !== 'visible') return;

      const unreadToMark = messageList.filter(
        (m) => m.receiverId === user.uid && !m.read && !markedReadIdsRef.current.has(m.id)
      );

      if (unreadToMark.length === 0) return;

      const now = Date.now();
      unreadToMark.forEach((msg) => {
        markedReadIdsRef.current.add(msg.id);
        updateDoc(doc(db, 'conversations', conversationId, 'messages', msg.id), {
          read: true,
          readAt: now,
        }).catch((err) => {
          markedReadIdsRef.current.delete(msg.id);
          console.warn('Failed to mark message read:', err);
        });
      });

      // Reset unread count for current user in conversation
      const convRef = doc(db, 'conversations', conversationId);
      updateDoc(convRef, {
        [`unreadCount.${user.uid}`]: 0,
      }).catch(() => {});
    },
    [conversationId, user?.uid]
  );

  // Real-time conversation setup and message listener
  useEffect(() => {
    if (!conversationId || !user?.uid) return;

    const convRef = doc(db, 'conversations', conversationId);
    getDoc(convRef).then((snap) => {
      if (!snap.exists()) {
        const initialConv: Partial<Conversation> = {
          id: conversationId,
          participants: [user.uid, otherUser.uid],
          participantData: {
            [user.uid]: {
              displayName: user.displayName,
              username: user.username,
              photoURL: user.photoURL,
            },
            [otherUser.uid]: {
              displayName: otherUser.displayName,
              username: otherUser.username,
              photoURL: otherUser.photoURL,
            },
          },
          unreadCount: { [user.uid]: 0, [otherUser.uid]: 0 },
          typing: { [user.uid]: false, [otherUser.uid]: false },
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
        setDoc(convRef, initialConv).catch(() => {});
      }
    });

    // Listen to conversation for typing status & reset unread count
    const unsubConv = onSnapshot(convRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Conversation;
        if (data.typing && data.typing[otherUser.uid]) {
          setIsOtherTyping(data.typing[otherUser.uid]);
        } else {
          setIsOtherTyping(false);
        }

        // Reset unread count if visible
        if (document.visibilityState === 'visible' && data.unreadCount && data.unreadCount[user.uid] > 0) {
          updateDoc(convRef, {
            [`unreadCount.${user.uid}`]: 0,
          }).catch(() => {});
        }
      }
    });

    // Listen to messages
    const messagesQuery = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(150)
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const list: ChatMessage[] = [];

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
        list.push(msg);
      });

      setMessages(list);
      setLoading(false);

      // Auto-mark unread messages as read when active
      markMessagesAsRead(list);
    });

    // Listen to tab visibility & focus to mark pending messages as read
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markMessagesAsRead(messages);
      } else {
        // Tab hidden -> clear typing status
        updateDoc(convRef, {
          [`typing.${user.uid}`]: false,
        }).catch(() => {});
      }
    };

    const handleFocus = () => {
      markMessagesAsRead(messages);
    };

    const handleBeforeUnload = () => {
      updateDoc(convRef, {
        [`typing.${user.uid}`]: false,
      }).catch(() => {});
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubConv();
      unsubMessages();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Clear typing indicator on exit
      if (conversationId && user?.uid) {
        updateDoc(convRef, {
          [`typing.${user.uid}`]: false,
        }).catch(() => {});
      }
    };
  }, [conversationId, user?.uid, otherUser.uid, markMessagesAsRead]);

  // Auto-scroll on new message
  useEffect(() => {
    if (!isSearching) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOtherTyping, isSearching]);

  // Handle typing input with debounced persistence
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    localStorage.setItem(`draft_${otherUser.uid}`, val);

    if (!conversationId || !user?.uid) return;

    const convRef = doc(db, 'conversations', conversationId);
    updateDoc(convRef, {
      [`typing.${user.uid}`]: 'typing',
    }).catch(() => {});

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      updateDoc(convRef, {
        [`typing.${user.uid}`]: false,
      }).catch(() => {});
    }, 2500);
  };

  // Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !user?.uid || !conversationId) return;

    setInputText('');
    localStorage.removeItem(`draft_${otherUser.uid}`);

    // Clear typing
    const convRef = doc(db, 'conversations', conversationId);
    updateDoc(convRef, {
      [`typing.${user.uid}`]: false,
    }).catch(() => {});

    try {
      const now = Date.now();
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');

      await addDoc(messagesRef, {
        conversationId,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        receiverId: otherUser.uid,
        text,
        type: 'text',
        timestamp: now,
        delivered: true,
        read: false,
      });

      // Update conversation
      const currentSnap = await getDoc(convRef);
      const currentUnread = currentSnap.data()?.unreadCount?.[otherUser.uid] || 0;

      await updateDoc(convRef, {
        lastMessage: {
          text,
          senderId: user.uid,
          senderName: user.displayName,
          timestamp: now,
          type: 'text',
        },
        [`unreadCount.${otherUser.uid}`]: currentUnread + 1,
        updatedAt: now,
      });

      // Send in-app notification
      await addDoc(collection(db, 'notifications'), {
        userId: otherUser.uid,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        type: 'message',
        title: user.displayName,
        body: text,
        data: { conversationId },
        read: false,
        createdAt: now,
      });

      // Send background FCM push notification
      triggerPushMessageNotification({
        senderId: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || undefined,
        receiverId: otherUser.uid,
        conversationId,
        messageText: text,
        messageType: 'text',
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  // Send Voice Message
  const handleSendVoiceMessage = async (audioUrl: string, durationSec: number) => {
    setIsRecordingAudio(false);
    if (!user?.uid || !conversationId) return;

    try {
      const now = Date.now();
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const convRef = doc(db, 'conversations', conversationId);

      await addDoc(messagesRef, {
        conversationId,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        receiverId: otherUser.uid,
        text: `🎙️ Voice message (${durationSec}s)`,
        type: 'voice_message',
        audioUrl,
        audioDuration: durationSec,
        timestamp: now,
        delivered: true,
        read: false,
      });

      const currentSnap = await getDoc(convRef);
      const currentUnread = currentSnap.data()?.unreadCount?.[otherUser.uid] || 0;

      await updateDoc(convRef, {
        lastMessage: {
          text: `🎙️ Voice message (${durationSec}s)`,
          senderId: user.uid,
          senderName: user.displayName,
          timestamp: now,
          type: 'voice_message',
          audioDuration: durationSec,
        },
        [`unreadCount.${otherUser.uid}`]: currentUnread + 1,
        updatedAt: now,
      });

      await addDoc(collection(db, 'notifications'), {
        userId: otherUser.uid,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        type: 'message',
        title: user.displayName,
        body: `🎙️ Sent a voice note (${durationSec}s)`,
        data: { conversationId },
        read: false,
        createdAt: now,
      });

      triggerPushMessageNotification({
        senderId: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || undefined,
        receiverId: otherUser.uid,
        conversationId,
        messageText: `🎙️ Sent a voice note (${durationSec}s)`,
        messageType: 'voice_message',
      });
    } catch (err) {
      console.error('Send voice error:', err);
    }
  };

  // Handle Image File Selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImageFile(event.target?.result as string);
      setImageCaption('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Image Message
  const handleSendImage = async () => {
    if (!selectedImageFile || !user?.uid || !conversationId) return;
    setIsSendingImage(true);

    try {
      const now = Date.now();
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const convRef = doc(db, 'conversations', conversationId);

      await addDoc(messagesRef, {
        conversationId,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        receiverId: otherUser.uid,
        text: imageCaption.trim() || '📷 Photo',
        type: 'image',
        imageUrl: selectedImageFile,
        imageCaption: imageCaption.trim(),
        timestamp: now,
        delivered: true,
        read: false,
      });

      const currentSnap = await getDoc(convRef);
      const currentUnread = currentSnap.data()?.unreadCount?.[otherUser.uid] || 0;

      await updateDoc(convRef, {
        lastMessage: {
          text: imageCaption.trim() ? `📷 ${imageCaption.trim()}` : '📷 Photo',
          senderId: user.uid,
          senderName: user.displayName,
          timestamp: now,
          type: 'image',
          hasImage: true,
        },
        [`unreadCount.${otherUser.uid}`]: currentUnread + 1,
        updatedAt: now,
      });

      await addDoc(collection(db, 'notifications'), {
        userId: otherUser.uid,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        type: 'message',
        title: user.displayName,
        body: imageCaption.trim() ? `📷 ${imageCaption.trim()}` : '📷 Sent a photo',
        data: { conversationId },
        read: false,
        createdAt: now,
      });

      triggerPushMessageNotification({
        senderId: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || undefined,
        receiverId: otherUser.uid,
        conversationId,
        messageText: imageCaption.trim() ? `📷 ${imageCaption.trim()}` : '📷 Sent a photo',
        messageType: 'image',
      });

      setSelectedImageFile(null);
      setImageCaption('');
    } catch (err) {
      console.error('Send image error:', err);
    } finally {
      setIsSendingImage(false);
    }
  };

  // Filter messages for search
  const matchedMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return false;
    return m.text?.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  // Group messages by date for date dividers
  const renderMessageList = () => {
    let lastDateStr = '';

    return messages.map((msg) => {
      const msgDate = new Date(msg.timestamp);
      const today = new Date();
      const isToday =
        msgDate.getDate() === today.getDate() &&
        msgDate.getMonth() === today.getMonth() &&
        msgDate.getFullYear() === today.getFullYear();

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        msgDate.getDate() === yesterday.getDate() &&
        msgDate.getMonth() === yesterday.getMonth() &&
        msgDate.getFullYear() === yesterday.getFullYear();

      let dateHeader = '';
      if (isToday) dateHeader = 'Today';
      else if (isYesterday) dateHeader = 'Yesterday';
      else dateHeader = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      const showDateDivider = dateHeader !== lastDateStr;
      if (showDateDivider) {
        lastDateStr = dateHeader;
      }

      return (
        <React.Fragment key={msg.id}>
          {showDateDivider && (
            <div className="flex justify-center my-3 select-none">
              <span className="px-3 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 uppercase tracking-wider shadow-2xs">
                {dateHeader}
              </span>
            </div>
          )}
          <MessageBubble
            message={msg}
            isSelf={msg.senderId === user?.uid}
            searchQuery={searchQuery}
            onRedialCall={(type) => startCall(liveOtherUser, type)}
            onImageClick={(url, cap) => setViewerImage({ url, caption: cap })}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <div
      id="jiya-chat-view"
      className="fixed inset-0 z-40 bg-white dark:bg-slate-950 flex flex-col w-full max-w-md mx-auto h-full select-none"
    >
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Fullscreen Image Lightbox Modal */}
      {viewerImage && (
        <ImageViewerModal
          imageUrl={viewerImage.url}
          caption={viewerImage.caption}
          onClose={() => setViewerImage(null)}
        />
      )}

      {/* User Profile Info Modal */}
      {showProfileModal && (
        <UserProfileModal
          user={liveOtherUser}
          onClose={() => setShowProfileModal(false)}
          onStartChat={() => {}}
        />
      )}

      {/* Top Header */}
      <div className="flex-shrink-0 px-3 py-2.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar & User Details */}
          <div
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
          >
            <div className="relative flex-shrink-0">
              <img
                src={
                  liveOtherUser.photoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${liveOtherUser.uid}`
                }
                alt={liveOtherUser.displayName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 group-hover:ring-2 ring-indigo-500 transition-all"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                  liveOtherUser.isOnline ? 'bg-green-500' : 'bg-slate-400'
                }`}
              />
            </div>

            <div className="min-w-0 pr-1 flex-1">
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {liveOtherUser.displayName}
                </h2>
                {isFav && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                {isMuted && <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span
                  className={`font-medium truncate ${
                    isOtherTyping
                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                      : liveOtherUser.isOnline
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-slate-400'
                  }`}
                >
                  {getPresenceText()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
              isSearching
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
            title="Search Messages"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            id="chat-voice-call-btn"
            onClick={() => startCall(liveOtherUser, 'voice')}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center justify-center transition-all active:scale-95"
            title="Start Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            id="chat-video-call-btn"
            onClick={() => startCall(liveOtherUser, 'video')}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center justify-center transition-all active:scale-95"
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* More Menu Dropdown for Mute / Favorite */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 z-50 w-48 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 text-xs select-none">
                <button
                  onClick={() => {
                    toggleFavorite(liveOtherUser.uid);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  <Star className={`w-4 h-4 ${isFav ? 'text-amber-500 fill-amber-500' : ''}`} />
                  <span>{isFav ? 'Remove Favorite' : 'Add to Favorites'}</span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Mute Notifications
                </div>

                {isMuted ? (
                  <button
                    onClick={() => {
                      unmuteChat(conversationId);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Unmute Chat</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        muteChat(conversationId, 3600000);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                      <span>For 1 hour</span>
                    </button>
                    <button
                      onClick={() => {
                        muteChat(conversationId, 28800000);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                      <span>For 8 hours</span>
                    </button>
                    <button
                      onClick={() => {
                        muteChat(conversationId, 604800000);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                      <span>For 1 week</span>
                    </button>
                    <button
                      onClick={() => {
                        muteChat(conversationId, -1);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                      <span>Always</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Message Search Bar */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 z-10"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Search in this chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {searchQuery && (
              <span className="text-[11px] font-medium text-slate-500 flex-shrink-0">
                {matchedMessages.length} {matchedMessages.length === 1 ? 'match' : 'matches'}
              </span>
            )}

            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal Before Sending */}
      <AnimatePresence>
        {selectedImageFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold">Send Photo to {liveOtherUser.displayName}</h3>
                <button
                  onClick={() => setSelectedImageFile(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative max-h-64 overflow-hidden rounded-2xl bg-slate-950/20 flex items-center justify-center">
                <img
                  src={selectedImageFile}
                  alt="Preview"
                  className="max-h-64 object-contain rounded-2xl"
                />
              </div>

              <input
                type="text"
                placeholder="Add a caption..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSelectedImageFile(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendImage}
                  disabled={isSendingImage}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingImage ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-white dark:bg-slate-950">
        {/* End-to-end indicator */}
        <div className="flex justify-center mb-4">
          <div className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-500 flex items-center gap-1.5 shadow-2xs">
            <Shield className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Messages & calls are private and direct.
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-3">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Say hello!</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              This is the beginning of your private conversation with {liveOtherUser.displayName}.
            </p>
          </div>
        ) : (
          renderMessageList()
        )}

        {/* Real-time Typing Indicator */}
        {isOtherTyping && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 w-fit text-slate-600 dark:text-slate-300 text-xs my-1"
          >
            <span className="text-[11px] font-medium text-slate-500">
              {isOtherTyping === 'recording'
                ? `${liveOtherUser.displayName.split(' ')[0]} is recording voice...`
                : `${liveOtherUser.displayName.split(' ')[0]} is typing`}
            </span>
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Mobile Composer Area */}
      <div className="flex-shrink-0 p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {isRecordingAudio ? (
          <AudioRecorder
            onSend={handleSendVoiceMessage}
            onCancel={() => setIsRecordingAudio(false)}
          />
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* Image Upload Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-50 active:scale-95 transition-all shadow-xs flex-shrink-0"
              title="Send Photo"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Message Input Box */}
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />

            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-200 dark:shadow-none flex-shrink-0 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingAudio(true)}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-200 dark:shadow-none flex-shrink-0 active:scale-95"
                title="Hold or Tap to Record Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
