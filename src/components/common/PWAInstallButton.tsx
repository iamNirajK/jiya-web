import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (compact) {
      return (
        <button
          onClick={install}
          aria-label="Install Jiya Web App"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold shadow-sm active:scale-95 transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50 active:scale-[0.99] transition-all shadow-sm ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Download className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Install Jiya App</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Fast full-screen mobile experience
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg">
          Add
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {compact ? (
          <button
            onClick={() => setShowIOSGuide(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-[11px] font-medium transition-all ${className}`}
          >
            <Smartphone className="w-3 h-3 text-indigo-600" />
            <span>Install</span>
          </button>
        ) : (
          <button
            onClick={() => setShowIOSGuide(true)}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 active:scale-[0.99] transition-all ${className}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Install on iOS</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Add Jiya to your Home Screen
                </p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              Guide
            </span>
          </button>
        )}

        <AnimatePresence>
          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Install Jiya on iPhone / iPad
                  </h3>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      1
                    </div>
                    <p className="leading-relaxed">
                      Tap the <Share2 className="w-3.5 h-3.5 inline mx-1 text-indigo-600" />{' '}
                      <strong>Share</strong> button at the bottom of Safari.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      2
                    </div>
                    <p className="leading-relaxed">
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      3
                    </div>
                    <p className="leading-relaxed">
                      Tap <strong>Add</strong> in the top-right corner to launch Jiya anytime!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
};
