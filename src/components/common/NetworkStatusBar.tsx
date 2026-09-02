import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const NetworkStatusBar: React.FC = () => {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-600 dark:bg-amber-700 text-white text-[11px] font-medium px-3 py-1.5 flex items-center justify-center gap-2 z-50 select-none shadow-inner"
        >
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>No internet connection — Messages will send when back online.</span>
          <RefreshCw className="w-3 h-3 animate-spin opacity-80" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
