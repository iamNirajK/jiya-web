import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, MessageSquare, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotifications();

  return (
    <div
      id="jiya-toast-container"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (toast.onClick) toast.onClick();
              removeToast(toast.id);
            }}
            className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 cursor-pointer select-none"
          >
            {toast.senderPhoto ? (
              <img
                src={toast.senderPhoto}
                alt=""
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
              />
            ) : toast.type === 'success' ? (
              <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : toast.type === 'error' ? (
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            ) : toast.type === 'warning' ? (
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : toast.type === 'message' ? (
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight truncate text-slate-900 dark:text-slate-100">
                {toast.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {toast.message}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
