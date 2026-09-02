import React from 'react';
import { ActiveTab } from '../../types';
import { MessageSquare, Phone, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unreadCount?: number;
  missedCallsCount?: number;
  unreadNotificationsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadCount = 0,
  missedCallsCount = 0,
  unreadNotificationsCount = 0,
}) => {
  const tabs = [
    { id: 'chats' as ActiveTab, label: 'Chats', icon: MessageSquare, badge: unreadCount },
    { id: 'calls' as ActiveTab, label: 'Calls', icon: Phone, badge: missedCallsCount },
    {
      id: 'notifications' as ActiveTab,
      label: 'Alerts',
      icon: Bell,
      badge: unreadNotificationsCount,
    },
    { id: 'profile' as ActiveTab, label: 'Profile', icon: User, badge: 0 },
  ];

  return (
    <nav
      id="jiya-bottom-nav"
      className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 select-none z-30 flex-shrink-0"
    >
      <div className="max-w-md mx-auto px-4 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all focus:outline-none select-none ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="relative flex flex-col items-center gap-1">
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                    }`}
                  />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
