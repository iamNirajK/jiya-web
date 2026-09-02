import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  getDoc,
  doc,
} from '../../lib/firebase';
import { CallSession, UserProfile, CallType } from '../../types';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RotateCcw,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';

interface CallsListProps {
  onOpenSearch: () => void;
}

export const CallsList: React.FC<CallsListProps> = ({ onOpenSearch }) => {
  const { user } = useAuth();
  const { startCall } = useCall();

  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  useEffect(() => {
    if (!user?.uid) return;

    // Listen to calls where current user is caller
    const qCaller = query(
      collection(db, 'calls'),
      where('callerId', '==', user.uid),
      limit(25)
    );

    // Listen to calls where current user is receiver
    const qReceiver = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      limit(25)
    );

    const callerMap = new Map<string, CallSession>();
    const receiverMap = new Map<string, CallSession>();

    const updateCombined = () => {
      const all = Array.from(new Set([...callerMap.values(), ...receiverMap.values()]));
      all.sort((a, b) => b.startedAt - a.startedAt);
      setCalls(all);
      setLoading(false);
    };

    const unsubCaller = onSnapshot(qCaller, (snapshot) => {
      snapshot.forEach((d) => callerMap.set(d.id, d.data() as CallSession));
      updateCombined();
    }, () => setLoading(false));

    const unsubReceiver = onSnapshot(qReceiver, (snapshot) => {
      snapshot.forEach((d) => receiverMap.set(d.id, d.data() as CallSession));
      updateCombined();
    }, () => setLoading(false));

    return () => {
      unsubCaller();
      unsubReceiver();
    };
  }, [user?.uid]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      now.getDate() === d.getDate() &&
      now.getMonth() === d.getMonth() &&
      now.getFullYear() === d.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleRedial = async (call: CallSession, type: CallType) => {
    const isOutgoing = call.callerId === user?.uid;
    const targetUid = isOutgoing ? call.receiverId : call.callerId;
    const targetName = isOutgoing ? call.receiverName : call.callerName;
    const targetPhoto = isOutgoing ? call.receiverPhoto : call.callerPhoto;

    const targetUser: UserProfile = {
      uid: targetUid,
      displayName: targetName,
      username: 'user',
      email: '',
      photoURL: targetPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUid}`,
      isOnline: true,
      lastSeen: Date.now(),
      createdAt: 0,
    };

    await startCall(targetUser, type);
  };

  const filteredCalls = calls.filter((call) => {
    if (filter === 'missed') {
      const isIncoming = call.receiverId === user?.uid;
      return isIncoming && (call.status === 'missed' || call.status === 'rejected');
    }
    return true;
  });

  return (
    <div id="jiya-calls-list" className="w-full pb-24 select-none">
      {/* Filter Tabs */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Calls ({calls.length})
          </button>
          <button
            onClick={() => setFilter('missed')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'missed'
                ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Missed
          </button>
        </div>

        <button
          onClick={onOpenSearch}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
        >
          New Call
        </button>
      </div>

      {/* Calls List */}
      <div className="px-2 space-y-0.5 mt-1">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading call logs...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              No recent calls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6 leading-relaxed">
              Start a crisp, direct voice or HD video call with any contact.
            </p>
            <button
              onClick={onOpenSearch}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-200 dark:shadow-none active:scale-95 transition-all flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>Start a Call</span>
            </button>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isOutgoing = call.callerId === user?.uid;
            const isMissed = call.status === 'missed' || call.status === 'rejected';
            const isVideo = call.type === 'video';
            const contactName = isOutgoing ? call.receiverName : call.callerName;
            const contactPhoto = isOutgoing ? call.receiverPhoto : call.callerPhoto;

            return (
              <motion.div
                key={call.callId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={contactPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${contactName}`}
                    alt={contactName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                  />

                  <div className="min-w-0 flex-1 pr-2">
                    <h3
                      className={`text-sm font-bold truncate ${
                        isMissed && !isOutgoing
                          ? 'text-rose-500'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {contactName}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isMissed && !isOutgoing ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      )}

                      <span className="truncate">
                        {isMissed && !isOutgoing
                          ? 'Missed call'
                          : call.status === 'connected' && call.duration
                          ? formatDuration(call.duration)
                          : isOutgoing
                          ? 'Outgoing'
                          : 'Incoming'}
                      </span>

                      <span>•</span>
                      <span>{formatTime(call.startedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Redial Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleRedial(call, isVideo ? 'video' : 'voice')}
                    className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center justify-center transition-all active:scale-95"
                    title={`Call back (${isVideo ? 'Video' : 'Voice'})`}
                  >
                    {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
