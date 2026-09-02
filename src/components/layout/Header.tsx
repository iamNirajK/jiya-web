import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, UserPlus } from 'lucide-react';
import { ActiveTab } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenSearch }) => {
  const { user } = useAuth();

  const getTitle = () => {
    switch (activeTab) {
      case 'chats':
        return 'Chats';
      case 'calls':
        return 'Call Log';
      case 'notifications':
        return 'Notifications';
      case 'profile':
        return 'My Profile';
      default:
        return 'Jiya';
    }
  };

  return (
    <header
      id="jiya-app-header"
      className="sticky top-0 z-30 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-colors flex-shrink-0"
    >
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand logo & active title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 shadow-sm shadow-indigo-200 flex items-center justify-center">
            <span className="text-sm font-black text-white">J</span>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-800 dark:text-white leading-none">
              JIYA
            </h1>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400">
              {getTitle()}
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <PWAInstallButton compact />

          <button
            id="header-search-btn"
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors border border-slate-200/70 dark:border-slate-700/60"
            title="Search users"
          >
            <Search className="w-4 h-4" />
          </button>

          {user && (
            <div className="relative">
              <img
                src={
                  user.photoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`
                }
                alt={user.displayName}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
