import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { calculateAge, validateDOB } from '../../lib/constants';
import {
  User,
  AtSign,
  Mail,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Bell,
  LogOut,
  Edit2,
  Check,
  X,
  Shield,
  Eye,
  EyeOff,
  Share2,
  Calendar,
  Settings,
  Lock,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { motion } from 'motion/react';

export const ProfileView: React.FC = () => {
  const {
    user,
    signOut,
    updateProfileData,
    updatePrivacySettings,
    checkUsernameAvailable,
    theme,
    toggleTheme,
    soundEnabled,
    toggleSound,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useAuth();

  const { requestNotificationPermission, addToast } = useNotifications();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const privacy = user?.privacySettings || {
    onlineStatus: 'everyone',
    lastSeen: 'everyone',
    readReceipts: true,
    typingIndicator: true,
  };

  const handleStartEdit = () => {
    setDisplayName(user?.displayName || '');
    setUsername(user?.username || '');
    setBio(user?.bio || '');
    setDateOfBirth(user?.dateOfBirth || '');
    setUsernameError(null);
    setDobError(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!username.trim() || username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (dateOfBirth) {
      const dobValidation = validateDOB(dateOfBirth);
      if (!dobValidation.isValid) {
        setDobError(dobValidation.error || 'Invalid date of birth');
        return;
      }
    }

    setSaving(true);
    setUsernameError(null);
    setDobError(null);

    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername !== user?.username) {
      const isAvail = await checkUsernameAvailable(cleanUsername);
      if (!isAvail) {
        setUsernameError('This username is already taken');
        setSaving(false);
        return;
      }
    }

    const success = await updateProfileData({
      displayName: displayName.trim() || user?.displayName,
      username: cleanUsername,
      bio: bio.trim(),
      dateOfBirth: dateOfBirth?.trim() ? dateOfBirth.trim() : undefined,
    });

    setSaving(false);
    if (success) {
      setIsEditing(false);
      addToast({
        title: 'Profile Updated',
        message: 'Your profile details have been saved.',
        type: 'success',
      });
    } else {
      addToast({
        title: 'Update Failed',
        message: 'Unable to update profile. Please try again.',
        type: 'error',
      });
    }
  };

  const handleShareMyProfile = async () => {
    const shareUrl = `${window.location.origin}/user/${user?.username}`;
    const shareData = {
      title: `${user?.displayName} on Jiya`,
      text: `Connect with me on Jiya: @${user?.username}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      addToast({
        title: 'Link Copied',
        message: 'Your profile URL has been copied to your clipboard.',
        type: 'success',
      });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      addToast({
        title: 'Error',
        message: 'Failed to copy link.',
        type: 'error',
      });
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        addToast({
          title: 'Notifications Enabled',
          message: 'You will receive alerts for new calls and messages.',
          type: 'success',
        });
      } else {
        setNotificationsEnabled(false);
        addToast({
          title: 'Permission Required',
          message: 'Please allow notifications in your browser settings.',
          type: 'warning',
        });
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  if (!user) return null;

  const currentAge = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
  const editingAge = dateOfBirth ? calculateAge(dateOfBirth) : null;

  return (
    <div id="jiya-profile-view" className="w-full max-w-md mx-auto p-4 pb-28 space-y-4 select-none">
      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <img
              src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
              alt={user.displayName}
              className="w-18 h-18 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
          </div>

          {!isEditing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareMyProfile}
                className="py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-1.5 transition-colors"
                title="Share Profile Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Share'}</span>
              </button>

              <button
                onClick={handleStartEdit}
                className="py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Profile Details (View or Edit) */}
        {!isEditing ? (
          <div className="space-y-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {user.displayName}
              </h2>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                @{user.username}
              </p>
            </div>

            {user.bio && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed pt-1">
                "{user.bio}"
              </p>
            )}

            {/* Badges / Meta Info */}
            <div className="flex flex-wrap gap-2 pt-2">
              {user.dateOfBirth && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200/60 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{currentAge !== null ? `${currentAge} years old` : user.dateOfBirth}</span>
                </span>
              )}

              {user.email && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-200/60 dark:border-slate-700">
                  <Mail className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{user.email}</span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Username (@)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  className="w-full py-2 pl-7 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              {usernameError && (
                <p className="text-[10px] text-rose-500 mt-1 font-medium">{usernameError}</p>
              )}
            </div>

            {/* Date of Birth Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500">
                  Date of Birth (Optional)
                </label>
                {editingAge !== null && (
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    Age: {editingAge} yrs
                  </span>
                )}
              </div>
              <input
                type="date"
                value={dateOfBirth}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {dobError && (
                <p className="text-[10px] text-rose-500 mt-1 font-medium">{dobError}</p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Bio
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Add a short status..."
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* PWA Install Button Card */}
      <PWAInstallButton />

      {/* Settings Section (Organized by Privacy, Notifications, Appearance, and Account) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-indigo-500" />
          <span>Settings</span>
        </h3>

        {/* 1. Privacy Controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Privacy</span>
          </h4>

          {/* Online Status */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                Online Status
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Who can see when you're online
              </p>
            </div>

            <select
              value={privacy.onlineStatus}
              onChange={(e) =>
                updatePrivacySettings({
                  onlineStatus: e.target.value as 'everyone' | 'nobody',
                })
              }
              className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          {/* Last Seen */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                Last Seen
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Who can see when you were last active
              </p>
            </div>

            <select
              value={privacy.lastSeen}
              onChange={(e) =>
                updatePrivacySettings({
                  lastSeen: e.target.value as 'everyone' | 'nobody',
                })
              }
              className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          {/* Read Receipts */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                Read Receipts
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Show blue checkmarks when messages are read
              </p>
            </div>

            <button
              onClick={() =>
                updatePrivacySettings({
                  readReceipts: !(privacy.readReceipts ?? true),
                })
              }
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                privacy.readReceipts ?? true ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  privacy.readReceipts ?? true ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Typing Indicator */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                Typing Indicators
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Show when you are typing a message
              </p>
            </div>

            <button
              onClick={() =>
                updatePrivacySettings({
                  typingIndicator: !(privacy.typingIndicator ?? true),
                })
              }
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                privacy.typingIndicator ?? true ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  privacy.typingIndicator ?? true ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 2. Notifications & Audio Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-indigo-500" />
            <span>Notifications & Audio</span>
          </h4>

          {/* Notifications Setting */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Push & In-App Alerts
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Incoming calls & message alerts
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Effects Setting */}
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Audio Ringtones & Chimes
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dial tone, ringtones & pop sounds
                </p>
              </div>
            </div>
            <button
              onClick={toggleSound}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                soundEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 3. Dark Mode / Appearance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
            {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-indigo-500" /> : <Sun className="w-3.5 h-3.5 text-indigo-500" />}
            <span>Appearance</span>
          </h4>

          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Dark Mode
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {theme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
        </div>

        {/* 4. Account Settings (Logout) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            <span>Account</span>
          </h4>

          {/* Logout */}
          <button
            id="profile-logout-btn"
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all active:scale-98 border border-slate-200/60 dark:border-slate-700/60"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out of Jiya</span>
          </button>
        </div>
      </div>

      {/* Brand Notice */}
      <div className="text-center pt-2">
        <p className="text-xs font-black tracking-tight text-slate-400">
          JIYA
        </p>
        <p className="text-[10px] text-slate-400">
          Private Direct Communication
        </p>
      </div>
    </div>
  );
};
