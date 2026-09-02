import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { CallProvider, useCall } from './context/CallContext';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { LoginView } from './components/auth/LoginView';
import { ChatList } from './components/chat/ChatList';
import { ChatView } from './components/chat/ChatView';
import { CallsList } from './components/calls/CallsList';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { ProfileView } from './components/profile/ProfileView';
import { UserSearchModal } from './components/chat/UserSearchModal';
import { IncomingCallModal } from './components/calls/IncomingCallModal';
import { ActiveCallView } from './components/calls/ActiveCallView';
import { ToastContainer } from './components/ui/ToastContainer';
import { NetworkStatusBar } from './components/common/NetworkStatusBar';
import { ActiveTab, UserProfile } from './types';
import { db, collection, query, where, getDocs, limit } from './lib/firebase';
import { AnimatePresence, motion } from 'motion/react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    unreadTotal,
    unreadNotificationCount,
    setActiveChatUserId,
    registerOpenChatHandler,
  } = useNotifications();
  const { activeCall } = useCall();

  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [selectedChatUser, setSelectedChatUser] = useState<UserProfile | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Synchronize active chat user with NotificationContext
  useEffect(() => {
    setActiveChatUserId(selectedChatUser ? selectedChatUser.uid : null);
  }, [selectedChatUser, setActiveChatUserId]);

  // Register openChat handler for toasts and external notifications
  useEffect(() => {
    registerOpenChatHandler((targetUser: UserProfile) => {
      setSelectedChatUser(targetUser);
    });
  }, [registerOpenChatHandler]);

  // Check URL path for direct profile share links (e.g. /user/:username)
  useEffect(() => {
    if (!user) return;
    const path = window.location.pathname;
    if (path.startsWith('/user/')) {
      const targetUsername = path.replace('/user/', '').replace(/^@/, '').toLowerCase().trim();
      if (targetUsername && targetUsername !== user.username) {
        const findUser = async () => {
          try {
            const q = query(
              collection(db, 'users'),
              where('username', '==', targetUsername),
              limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const u = snap.docs[0].data() as UserProfile;
              setSelectedChatUser(u);
            }
          } catch (e) {
            console.warn('Find shared user error:', e);
          }
        };
        findUser();
      }
    }
  }, [user]);

  // Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F9FAFB] dark:bg-slate-950 text-slate-900 dark:text-white select-none">
        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-200 flex items-center justify-center mb-4"
        >
          <span className="text-2xl font-black text-white">J</span>
        </motion.div>
        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">JIYA</h1>
        <p className="text-xs font-medium text-slate-500 italic mt-1">Talk. Connect. Anytime.</p>
        <div className="mt-6 flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-150" />
          <span className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse delay-300" />
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login View
  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between items-center font-sans antialiased">
      {/* Clean Minimal Desktop Header (Visible on sm+ screens) */}
      <header className="hidden sm:flex w-full max-w-4xl px-8 py-5 justify-between items-center z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">JIYA</h1>
        </div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 italic">
          Talk. Connect. Anytime.
        </div>
      </header>

      {/* Main Container / Mobile Screen */}
      <div className="w-full max-w-md h-screen sm:h-[86vh] sm:max-h-[820px] bg-white dark:bg-slate-900 flex flex-col relative overflow-hidden sm:rounded-[36px] shadow-2xl sm:shadow-slate-200/80 dark:sm:shadow-slate-950/60 sm:border border-slate-200/80 dark:border-slate-800">
        {/* Network offline/reconnecting status banner */}
        <NetworkStatusBar />

        {/* Floating Toasts */}
        <ToastContainer />

        {/* Incoming Call Alert Modal */}
        <IncomingCallModal />

        {/* Active Call Fullscreen View */}
        <AnimatePresence>
          {activeCall && <ActiveCallView />}
        </AnimatePresence>

        {/* Active One-to-One Chat View */}
        <AnimatePresence>
          {selectedChatUser && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="absolute inset-0 z-40 bg-white dark:bg-slate-950"
            >
              <ChatView
                otherUser={selectedChatUser}
                onBack={() => setSelectedChatUser(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Search & New Conversation Modal */}
        <UserSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectUser={(u) => {
            setSelectedChatUser(u);
            setIsSearchOpen(false);
          }}
        />

        {/* App Top Header */}
        <Header
          activeTab={activeTab}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        {/* Main Content Area based on Tab */}
        <main className="flex-1 overflow-y-auto relative bg-white dark:bg-slate-900">
          <AnimatePresence mode="wait">
            {activeTab === 'chats' && (
              <motion.div
                key="chats-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChatList
                  onSelectUser={(u) => setSelectedChatUser(u)}
                  onOpenSearch={() => setIsSearchOpen(true)}
                />
              </motion.div>
            )}

            {activeTab === 'calls' && (
              <motion.div
                key="calls-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <CallsList onOpenSearch={() => setIsSearchOpen(true)} />
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <NotificationCenter onSelectUser={(u) => setSelectedChatUser(u)} />
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ProfileView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unreadCount={unreadTotal}
          unreadNotificationsCount={unreadNotificationCount}
        />
      </div>

      {/* Clean Minimal Desktop Footer */}
      <footer className="hidden sm:block w-full py-4 text-center text-slate-400 dark:text-slate-500 text-[11px] font-medium tracking-widest uppercase select-none">
        Secure • Direct • Real-time
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <CallProvider>
          <MainApp />
        </CallProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
