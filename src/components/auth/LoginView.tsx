import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { MessageSquare, Phone, Video, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError('Unable to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="jiya-login-view"
      className="min-h-screen w-full flex flex-col justify-between items-center p-6 bg-[#F9FAFB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative select-none"
    >
      {/* Top Header & Logo */}
      <div className="w-full max-w-4xl pt-4 sm:pt-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <span className="text-white font-bold text-xl">J</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">JIYA</h1>
        </div>
        <div className="text-xs sm:text-sm font-medium text-slate-500 italic">
          Talk. Connect. Anytime.
        </div>
      </div>

      {/* Center Welcome Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm my-auto z-10"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[36px] p-8 shadow-2xl shadow-slate-200/60 dark:shadow-slate-950/80 text-center">
          {/* Indigo Emblem */}
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl rotate-12 flex items-center justify-center shadow-md shadow-indigo-300 dark:shadow-none">
              <span className="text-white font-black text-xl -rotate-12">J</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome to Jiya
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-7 leading-relaxed">
            Connect with people through real-time chat, voice, and video calls.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* Primary Google Login Button */}
          <button
            id="google-signin-button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all text-slate-800 dark:text-white font-semibold text-sm active:scale-[0.98] disabled:opacity-50"
          >
            {/* Google 'G' Mark */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-slate-400 text-xs">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Messaging
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-500" /> Voice
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-500" /> Video
            </span>
          </div>
        </div>
      </motion.div>

      {/* Footer Security Badge */}
      <footer className="w-full py-4 text-center text-slate-400 dark:text-slate-500 text-xs font-medium tracking-widest uppercase z-10 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
        <span>Secure • Real-time • Direct</span>
      </footer>
    </div>
  );
};
