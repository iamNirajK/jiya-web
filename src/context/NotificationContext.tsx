import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from '../lib/firebase';
import { AppNotification, UserProfile, Conversation, UserNotificationSettings } from '../types';
import { audioService } from '../lib/audioService';
import {
  registerPushServiceWorker,
  requestAndRegisterFCMToken,
  unregisterDevicePushToken,
  listenToForegroundMessages,
} from '../lib/pushClient';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'message';
  senderPhoto?: string;
  onClick?: () => void;
  duration?: number;
}

export type PushPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationContextType {
  toasts: ToastItem[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  unreadTotal: number;
  setUnreadTotal: React.Dispatch<React.SetStateAction<number>>;
  activeChatUserId: string | null;
  setActiveChatUserId: (uid: string | null) => void;
  pushPermissionStatus: PushPermissionStatus;
  fcmToken: string | null;
  enablePushNotifications: () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  sendTestPush: () => Promise<boolean>;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  requestNotificationPermission: () => Promise<boolean>;
  registerOpenChatHandler: (handler: (user: UserProfile) => void) => void;
  openChatWithUser: (user: UserProfile) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, soundEnabled, notificationsEnabled, isChatMuted, setNotificationsEnabled } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);

  // Push notification state
  const [pushPermissionStatus, setPushPermissionStatus] = useState<PushPermissionStatus>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(() => {
    return localStorage.getItem('jiya_fcm_token');
  });

  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const openChatHandlerRef = useRef<((user: UserProfile) => void) | null>(null);

  // Check initial browser notification permission state
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermissionStatus('unsupported');
    } else {
      setPushPermissionStatus(Notification.permission as PushPermissionStatus);
    }
  }, []);

  // Unlock web audio on first user gesture
  useEffect(() => {
    const handleGesture = () => {
      audioService.unlockAudio();
    };
    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('touchstart', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Register push service worker on boot
  useEffect(() => {
    registerPushServiceWorker().catch(() => {});
  }, []);

  // Listen to messages from Service Worker (e.g. notification clicked or call action)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'NOTIFICATION_CLICK') {
        const payload = data.data || {};
        if (payload.senderId) {
          openChatWithUser({
            uid: payload.senderId,
            displayName: payload.senderName || 'User',
            username: payload.senderName?.toLowerCase().replace(/\s+/g, '_') || 'user',
            email: '',
            photoURL: payload.senderPhoto || '',
          });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  const registerOpenChatHandler = useCallback((handler: (user: UserProfile) => void) => {
    openChatHandlerRef.current = handler;
  }, []);

  const openChatWithUser = useCallback((targetUser: UserProfile) => {
    if (openChatHandlerRef.current) {
      openChatHandlerRef.current(targetUser);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...toast, id };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (toast.type === 'message' && soundEnabled) {
        audioService.playMessageChime();
      }

      const dur = toast.duration || 4500;
      window.setTimeout(() => {
        removeToast(id);
      }, dur);
    },
    [soundEnabled, removeToast]
  );

  /**
   * Request Notification Permission and register FCM Push Token
   */
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPushPermissionStatus('unsupported');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPushPermissionStatus(perm as PushPermissionStatus);

      if (perm === 'granted') {
        setNotificationsEnabled(true);
        if (user?.uid) {
          const token = await requestAndRegisterFCMToken(user.uid);
          if (token) {
            setFcmToken(token);
            localStorage.setItem('jiya_fcm_token', token);
          }
        }
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Request notification permission notice:', e);
      return false;
    }
  };

  const enablePushNotifications = async (): Promise<boolean> => {
    return await requestNotificationPermission();
  };

  const disablePushNotifications = async (): Promise<void> => {
    setNotificationsEnabled(false);
    if (user?.uid && fcmToken) {
      await unregisterDevicePushToken(user.uid, fcmToken);
      setFcmToken(null);
      localStorage.removeItem('jiya_fcm_token');
    }
  };

  const sendTestPush = async (): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          displayName: user.displayName,
        }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  // Sync / refresh FCM token when user logs in if permission already granted
  useEffect(() => {
    if (
      user?.uid &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      notificationsEnabled
    ) {
      requestAndRegisterFCMToken(user.uid).then((token) => {
        if (token) {
          setFcmToken(token);
          localStorage.setItem('jiya_fcm_token', token);
        }
      });
    }
  }, [user?.uid, notificationsEnabled]);

  // Listen for FCM foreground messages
  useEffect(() => {
    if (!user?.uid || !notificationsEnabled) return;

    const cleanup = listenToForegroundMessages((payload) => {
      // Check if user is currently inside this exact chat and page is visible
      const isChatActive =
        activeChatUserId === payload.senderId && document.visibilityState === 'visible';

      if (isChatActive) {
        // Skip duplicate toast
        return;
      }

      const senderName = payload.senderName || 'New Message';
      const body = payload.messageText || 'Sent you a message';

      addToast({
        title: senderName,
        message: body,
        type: 'message',
        senderPhoto: payload.senderPhoto,
        onClick: () => {
          if (payload.senderId) {
            openChatWithUser({
              uid: payload.senderId,
              displayName: senderName,
              username: senderName.toLowerCase().replace(/\s+/g, '_'),
              email: '',
              photoURL: payload.senderPhoto || '',
            });
          }
        },
      });
    });

    return () => cleanup();
  }, [user?.uid, notificationsEnabled, activeChatUserId, addToast, openChatWithUser]);

  // 1. Listen to user conversations to keep global unreadTotal badge updated
  useEffect(() => {
    if (!user?.uid) {
      setUnreadTotal(0);
      return;
    }

    const convQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      convQuery,
      (snapshot) => {
        let total = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Conversation;
          if (data.unreadCount && typeof data.unreadCount[user.uid] === 'number') {
            total += data.unreadCount[user.uid];
          }
        });
        setUnreadTotal(total);

        // App Badging API for installed PWA & mobile app icon
        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
          if (total > 0) {
            navigator.setAppBadge(total).catch(() => {});
          } else if ('clearAppBadge' in navigator) {
            navigator.clearAppBadge().catch(() => {});
          }
        }
      },
      (err) => {
        console.warn('Conversations unread listener notice:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Real-time listener for in-app notification center & incoming message toasts
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      notifiedIdsRef.current.clear();
      isInitialLoadRef.current = true;
      return;
    }

    isInitialLoadRef.current = true;
    notifiedIdsRef.current.clear();

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
        });

        // Sort descending by creation date in memory
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setNotifications(list);

        // On first initial load, seed notifiedIdsRef so we don't alert on historical notifications
        if (isInitialLoadRef.current) {
          snapshot.forEach((docSnap) => {
            notifiedIdsRef.current.add(docSnap.id);
          });
          isInitialLoadRef.current = false;
          return;
        }

        // Process newly arrived notifications
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notifId = change.doc.id;
            const data = change.doc.data() as AppNotification;

            if (notifiedIdsRef.current.has(notifId)) return;
            notifiedIdsRef.current.add(notifId);

            if (data.senderId === user.uid) return;
            if (data.read) return;

            const convId = data.data?.conversationId;

            // Check if conversation is muted
            if (convId && isChatMuted(convId)) {
              return;
            }

            // If user is actively inside this exact chat and window is visible, don't overlay a toast banner
            const isCurrentlyInThisChat =
              activeChatUserId === data.senderId && document.visibilityState === 'visible';

            if (!isCurrentlyInThisChat && notificationsEnabled) {
              const senderDisplayName = data.senderName || data.title || 'New Message';
              const messageText = data.body || 'Sent you a message';

              // Show in-app banner toast
              addToast({
                title: senderDisplayName,
                message: messageText,
                type: 'message',
                senderPhoto: data.senderPhoto,
                onClick: () => {
                  if (data.senderId) {
                    openChatWithUser({
                      uid: data.senderId,
                      displayName: senderDisplayName,
                      username: data.senderName?.toLowerCase().replace(/\s+/g, '_') || 'user',
                      email: '',
                      photoURL: data.senderPhoto || '',
                    });
                  }
                },
              });
            }
          }
        });
      },
      (err) => {
        console.warn('Notifications snapshot error notice:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, notificationsEnabled, isChatMuted, activeChatUserId, addToast, openChatWithUser]);

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e) {
      console.warn('Mark notification as read error:', e);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!notifications.length) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.read) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.warn('Mark all as read error:', e);
    }
  };

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        notifications,
        unreadNotificationCount,
        unreadTotal,
        setUnreadTotal,
        activeChatUserId,
        setActiveChatUserId,
        pushPermissionStatus,
        fcmToken,
        enablePushNotifications,
        disablePushNotifications,
        sendTestPush,
        addToast,
        removeToast,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        requestNotificationPermission,
        registerOpenChatHandler,
        openChatWithUser,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
