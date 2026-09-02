import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  FirebaseUser,
} from '../lib/firebase';
import { UserProfile, PrivacySettings, UserNotificationSettings } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<boolean>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  toggleFavorite: (targetUid: string) => Promise<void>;
  togglePinChat: (conversationId: string) => Promise<void>;
  muteChat: (conversationId: string, durationMs: number) => Promise<void>;
  unmuteChat: (conversationId: string) => Promise<void>;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => Promise<boolean>;
  updateNotificationSettings: (settings: Partial<UserNotificationSettings>) => Promise<boolean>;
  isChatMuted: (conversationId: string) => boolean;
  isFavorite: (targetUid: string) => boolean;
  isChatPinned: (conversationId: string) => boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const DEFAULT_PRIVACY: PrivacySettings = {
  onlineStatus: 'everyone',
  lastSeen: 'everyone',
  readReceipts: true,
  typingIndicator: true,
  showPreview: true,
};

export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  messages: true,
  incomingCalls: true,
  missedCalls: true,
  sound: true,
  vibration: true,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('jiya_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  // Sound preference
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('jiya_sound') !== 'false';
  });

  // Notification preference
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('jiya_notifications') !== 'false';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('jiya_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('jiya_sound', String(next));
      return next;
    });
  };

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    localStorage.setItem('jiya_notifications', String(enabled));
  };

  // Helper to generate a clean username
  const generateUsername = (name: string, email: string): string => {
    const base = (name || email.split('@')[0] || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 14);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${base}_${rand}`;
  };

  // Sync user profile with Firestore
  const syncUserProfile = async (fbUser: FirebaseUser | { uid: string; displayName: string | null; email: string | null; photoURL: string | null }) => {
    try {
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);

      const now = Date.now();
      if (!snap.exists()) {
        const username = generateUsername(fbUser.displayName || '', fbUser.email || '');
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Jiya User',
          username,
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
          isOnline: true,
          lastSeen: now,
          createdAt: now,
          bio: 'Hey there! I am using Jiya.',
          favorites: [],
          pinnedChats: [],
          mutedChats: {},
          privacySettings: DEFAULT_PRIVACY,
        };
        await setDoc(userRef, newProfile);
        setUser(newProfile);
      } else {
        const existing = snap.data() as UserProfile;
        const updated: UserProfile = {
          ...existing,
          displayName: fbUser.displayName || existing.displayName,
          photoURL: fbUser.photoURL || existing.photoURL,
          isOnline: true,
          lastSeen: now,
          favorites: existing.favorites || [],
          pinnedChats: existing.pinnedChats || [],
          mutedChats: existing.mutedChats || {},
          privacySettings: existing.privacySettings || DEFAULT_PRIVACY,
        };
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: now,
          displayName: updated.displayName,
          photoURL: updated.photoURL,
        });
        setUser(updated);
      }
    } catch (err) {
      console.error('Error syncing profile with Firestore:', err);
      const fallback: UserProfile = {
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Jiya User',
        username: generateUsername(fbUser.displayName || '', fbUser.email || ''),
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
        isOnline: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
        favorites: [],
        pinnedChats: [],
        mutedChats: {},
        privacySettings: DEFAULT_PRIVACY,
      };
      setUser(fallback);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserProfile(fbUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Presence & Heartbeat tracking
  useEffect(() => {
    if (!user?.uid) return;

    const setPresence = async (isOnline: boolean) => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          isOnline,
          lastSeen: Date.now(),
        });
      } catch (e) {
        // Silently handle
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPresence(true);
      } else {
        setPresence(false);
      }
    };

    const handleBeforeUnload = () => {
      setPresence(false);
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setPresence(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
    };
  }, [user?.uid]);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: Date.now(),
        });
      } catch (e) {}
    }
    await fbSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    if (!username || username.length < 4 || username.length > 20) return false;
    const clean = username.toLowerCase().trim();
    if (user?.username === clean) return true;

    try {
      const q = query(collection(db, 'users'), where('username', '==', clean));
      const snap = await getDocs(q);
      return snap.empty;
    } catch (e) {
      console.warn('Username check error:', e);
      return true;
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatePayload: Record<string, any> = {
        lastSeen: Date.now(),
      };
      const localUpdated: Record<string, any> = {
        lastSeen: Date.now(),
      };

      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          updatePayload[key] = deleteField();
        } else {
          updatePayload[key] = value;
          localUpdated[key] = value;
        }
      });

      await updateDoc(userRef, updatePayload);
      setUser((prev) => {
        if (!prev) return null;
        const next = { ...prev, ...localUpdated };
        Object.entries(data).forEach(([key, value]) => {
          if (value === undefined || value === null) {
            delete (next as any)[key];
          }
        });
        return next as UserProfile;
      });
      return true;
    } catch (err) {
      console.error('Error updating profile:', err);
      return false;
    }
  };

  // Toggle Favorite Contact
  const toggleFavorite = async (targetUid: string) => {
    if (!user?.uid || !targetUid) return;
    const currentFavorites = user.favorites || [];
    const isFav = currentFavorites.includes(targetUid);
    const updatedFavorites = isFav
      ? currentFavorites.filter((id) => id !== targetUid)
      : [...currentFavorites, targetUid];

    setUser((prev) => (prev ? { ...prev, favorites: updatedFavorites } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favorites: updatedFavorites,
      });
    } catch (e) {
      console.warn('Toggle favorite error:', e);
    }
  };

  // Toggle Pin Chat
  const togglePinChat = async (conversationId: string) => {
    if (!user?.uid || !conversationId) return;
    const currentPinned = user.pinnedChats || [];
    const isPinned = currentPinned.includes(conversationId);
    const updatedPinned = isPinned
      ? currentPinned.filter((id) => id !== conversationId)
      : [...currentPinned, conversationId];

    setUser((prev) => (prev ? { ...prev, pinnedChats: updatedPinned } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pinnedChats: updatedPinned,
      });
    } catch (e) {
      console.warn('Toggle pin error:', e);
    }
  };

  // Mute Chat for a duration (in ms: 3600000 = 1h, 28800000 = 8h, 604800000 = 1w, -1 = Always)
  const muteChat = async (conversationId: string, durationMs: number) => {
    if (!user?.uid || !conversationId) return;
    const mutedUntil = durationMs === -1 ? Number.MAX_SAFE_INTEGER : Date.now() + durationMs;
    const updatedMuted = {
      ...(user.mutedChats || {}),
      [conversationId]: mutedUntil,
    };

    setUser((prev) => (prev ? { ...prev, mutedChats: updatedMuted } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        mutedChats: updatedMuted,
      });
    } catch (e) {
      console.warn('Mute chat error:', e);
    }
  };

  // Unmute Chat
  const unmuteChat = async (conversationId: string) => {
    if (!user?.uid || !conversationId) return;
    const updatedMuted = { ...(user.mutedChats || {}) };
    delete updatedMuted[conversationId];

    setUser((prev) => (prev ? { ...prev, mutedChats: updatedMuted } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        mutedChats: updatedMuted,
      });
    } catch (e) {
      console.warn('Unmute chat error:', e);
    }
  };

  // Privacy Settings Update
  const updatePrivacySettings = async (settings: Partial<PrivacySettings>): Promise<boolean> => {
    if (!user?.uid) return false;
    const newSettings: PrivacySettings = {
      ...(user.privacySettings || DEFAULT_PRIVACY),
      ...settings,
    };

    setUser((prev) => (prev ? { ...prev, privacySettings: newSettings } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        privacySettings: newSettings,
      });
      return true;
    } catch (e) {
      console.warn('Update privacy error:', e);
      return false;
    }
  };

  // Notification Settings Update
  const updateNotificationSettings = async (settings: Partial<UserNotificationSettings>): Promise<boolean> => {
    if (!user?.uid) return false;
    const newSettings: UserNotificationSettings = {
      ...(user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS),
      ...settings,
    };

    setUser((prev) => (prev ? { ...prev, notificationSettings: newSettings } : null));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: newSettings,
      });
      return true;
    } catch (e) {
      console.warn('Update notification settings error:', e);
      return false;
    }
  };

  const isChatMuted = (conversationId: string): boolean => {
    if (!user?.mutedChats || !user.mutedChats[conversationId]) return false;
    return user.mutedChats[conversationId] > Date.now();
  };

  const isFavorite = (targetUid: string): boolean => {
    return !!user?.favorites?.includes(targetUid);
  };

  const isChatPinned = (conversationId: string): boolean => {
    return !!user?.pinnedChats?.includes(conversationId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signInWithGoogle,
        signOut,
        updateProfileData,
        checkUsernameAvailable,
        toggleFavorite,
        togglePinChat,
        muteChat,
        unmuteChat,
        updatePrivacySettings,
        updateNotificationSettings,
        isChatMuted,
        isFavorite,
        isChatPinned,
        theme,
        toggleTheme,
        soundEnabled,
        toggleSound,
        notificationsEnabled,
        setNotificationsEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
