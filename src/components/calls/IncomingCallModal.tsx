import React from 'react';
import { useCall } from '../../context/CallContext';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion } from 'motion/react';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  const isVideo = incomingCall.type === 'video';

  return (
    <div
      id="jiya-incoming-call-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-sm flex flex-col items-center text-center p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl"
      >
        {/* Call Type Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-6">
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        {/* Pulsating Caller Avatar */}
        <div className="relative mb-6">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="absolute -inset-3 rounded-full bg-indigo-500/20"
          />

          <img
            src={
              incomingCall.callerPhoto ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${incomingCall.callerName}`
            }
            alt={incomingCall.callerName}
            className="w-24 h-24 rounded-full object-cover relative z-10 border-2 border-slate-200 dark:border-slate-700 shadow-md"
          />
        </div>

        {/* Caller Info */}
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
          {incomingCall.callerName}
        </h2>
        <p className="text-xs text-slate-400 mb-8">
          Jiya Direct Call • Ringing...
        </p>

        {/* Action Buttons */}
        <div className="w-full flex items-center justify-center gap-8">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              id="decline-call-btn"
              onClick={rejectCall}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              id="accept-call-btn"
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95 transition-all animate-bounce"
            >
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Accept</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
