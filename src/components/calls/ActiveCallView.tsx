import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  SwitchCamera,
  Shield,
  Wifi,
} from 'lucide-react';
import { motion } from 'motion/react';

export const ActiveCallView: React.FC = () => {
  const { user } = useAuth();
  const {
    activeCall,
    localStream,
    remoteStream,
    callDuration,
    isAudioMuted,
    isVideoMuted,
    isSpeakerOn,
    endCall,
    toggleAudioMute,
    toggleVideoMute,
    toggleSpeaker,
    flipCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.type]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall?.type]);

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const isCaller = activeCall.callerId === user?.uid;
  const remoteName = isCaller ? activeCall.receiverName : activeCall.callerName;
  const remotePhoto = isCaller ? activeCall.receiverPhoto : activeCall.callerPhoto;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="jiya-active-call-view"
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Top Header Information */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {activeCall.status === 'connected'
                ? formatTimer(callDuration)
                : activeCall.status === 'calling'
                ? 'Ringing...'
                : 'Connecting...'}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-slate-900/60 backdrop-blur-md text-[10px] text-slate-400 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>HD WebRTC</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px]">Direct Peer-to-Peer</span>
        </div>
      </div>

      {/* Main Stage */}
      {isVideo ? (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Placeholder if remote video stream not active yet */}
          {(!remoteStream || remoteStream.getVideoTracks().length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6">
              <img
                src={remotePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${remoteName}`}
                alt={remoteName}
                className="w-28 h-28 rounded-full object-cover border-4 border-indigo-500/40 shadow-2xl mb-4"
              />
              <h2 className="text-xl font-bold text-white mb-1">{remoteName}</h2>
              <p className="text-xs text-slate-400">
                {activeCall.status === 'calling'
                  ? 'Waiting for answer...'
                  : 'Connecting video stream...'}
              </p>
            </div>
          )}

          {/* Floating Local Video Preview (Picture in Picture) */}
          <motion.div
            drag
            dragConstraints={{ left: -120, right: 120, top: -200, bottom: 200 }}
            className="absolute top-20 right-4 z-20 w-28 h-40 sm:w-36 sm:h-52 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 cursor-grab active:cursor-grabbing"
          >
            {isVideoMuted ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
                <VideoOff className="w-6 h-6 mb-1" />
                <span className="text-[9px]">Camera Off</span>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            )}
          </motion.div>
        </div>
      ) : (
        /* Voice Call Stage */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
          <div className="relative mb-8">
            {activeCall.status === 'connected' && (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="absolute -inset-6 rounded-full bg-indigo-500/20"
              />
            )}
            <img
              src={remotePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${remoteName}`}
              alt={remoteName}
              className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-indigo-500/30 shadow-2xl shadow-indigo-950/80"
            />
          </div>

          <h2 className="text-2xl font-black text-white mb-2">{remoteName}</h2>
          <p className="text-sm font-medium text-indigo-400 mb-2">
            {activeCall.status === 'connected'
              ? formatTimer(callDuration)
              : activeCall.status === 'calling'
              ? 'Ringing...'
              : 'Connecting...'}
          </p>
          <p className="text-xs text-slate-500">High-Definition Voice Call</p>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="relative z-20 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 px-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <div className="max-w-md mx-auto flex items-center justify-around gap-2">
          {/* Mute Audio */}
          <button
            id="toggle-mic-btn"
            onClick={toggleAudioMute}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
              isAudioMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-slate-800/80 text-white hover:bg-slate-700 border border-slate-700'
            }`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Camera (Video Calls) */}
          {isVideo && (
            <button
              id="toggle-video-btn"
              onClick={toggleVideoMute}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
                isVideoMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-slate-800/80 text-white hover:bg-slate-700 border border-slate-700'
              }`}
              title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* Flip Camera (Video Calls) */}
          {isVideo && (
            <button
              id="flip-camera-btn"
              onClick={flipCamera}
              className="w-13 h-13 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-all active:scale-95"
              title="Flip Front/Back Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Speakerphone */}
          <button
            id="toggle-speaker-btn"
            onClick={toggleSpeaker}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
              isSpeakerOn
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Speaker"
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            id="end-call-btn"
            onClick={endCall}
            className="w-15 h-15 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 active:scale-90 transition-all flex-shrink-0"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
