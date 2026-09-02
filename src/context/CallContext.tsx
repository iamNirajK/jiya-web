import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import {
  db,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  limit,
} from '../lib/firebase';
import { CallType, CallStatus, CallSession, UserProfile } from '../types';
import { getRtcConfiguration, getUserMediaStream, stopMediaStream } from '../lib/webrtc';
import { audioService } from '../lib/audioService';

interface CallContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callDuration: number;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isSpeakerOn: boolean;
  facingMode: 'user' | 'environment';
  callQuality: 'good' | 'fair' | 'poor';
  startCall: (receiver: UserProfile, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudioMute: () => void;
  toggleVideoMute: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, soundEnabled } = useAuth();
  const { addToast } = useNotifications();

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [callDuration, setCallDuration] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [callQuality, setCallQuality] = useState<'good' | 'fair' | 'poor'>('good');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callUnsubRef = useRef<(() => void) | null>(null);
  const candidateUnsubRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);

  // Stop local and remote streams safely
  const cleanupMediaAndPeer = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      stopMediaStream(localStream);
      setLocalStream(null);
    }
    if (remoteStream) {
      stopMediaStream(remoteStream);
      setRemoteStream(null);
    }

    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }
    if (candidateUnsubRef.current) {
      candidateUnsubRef.current();
      candidateUnsubRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    audioService.stopAll();
    setCallDuration(0);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  };

  // Helper to record call in conversation messages & history
  const logCallSummary = async (
    session: CallSession,
    finalStatus: 'connected' | 'missed' | 'rejected' | 'ended' | 'busy',
    durationSec: number
  ) => {
    try {
      const convId = [session.callerId, session.receiverId].sort().join('_');
      const messagesRef = collection(db, 'conversations', convId, 'messages');

      const isVideo = session.type === 'video';
      let text = '';
      if (finalStatus === 'missed') {
        text = isVideo ? '🎥 Missed video call' : '📞 Missed voice call';
      } else if (finalStatus === 'rejected') {
        text = isVideo ? '🎥 Declined video call' : '📞 Declined voice call';
      } else if (finalStatus === 'busy') {
        text = isVideo ? '🎥 Missed video call (User was busy)' : '📞 Missed voice call (User was busy)';
      } else {
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        text = isVideo ? `🎥 Video call (${durStr})` : `📞 Voice call (${durStr})`;
      }

      await addDoc(messagesRef, {
        conversationId: convId,
        senderId: session.callerId,
        senderName: session.callerName,
        senderPhoto: session.callerPhoto || '',
        receiverId: session.receiverId,
        text,
        type: isVideo ? 'video_call' : 'voice_call',
        callDuration: durationSec,
        callStatus: finalStatus,
        timestamp: Date.now(),
        delivered: true,
        read: false,
      });

      // Update conversation lastMessage
      const convRef = doc(db, 'conversations', convId);
      await updateDoc(convRef, {
        lastMessage: {
          text,
          senderId: session.callerId,
          timestamp: Date.now(),
          type: isVideo ? 'video_call' : 'voice_call',
          callDuration: durationSec,
          callStatus: finalStatus,
        },
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('Call log error:', e);
    }
  };

  // Listen for incoming calls targeting current user
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as CallSession;
          // Check if user is already on a call -> auto respond busy
          if (activeCall) {
            try {
              await updateDoc(doc(db, 'calls', docData.callId), {
                status: 'busy',
                endedAt: Date.now(),
              });
              logCallSummary(docData, 'busy', 0);
            } catch (e) {}
            return;
          }

          // Check if not expired (> 45s)
          if (Date.now() - docData.startedAt < 45000 && !activeCall) {
            setIncomingCall(docData);
            if (soundEnabled) {
              audioService.startIncomingRingtone();
            }
          }
        } else {
          // If calling doc was removed or status changed
          setIncomingCall((current) => {
            if (current) {
              audioService.stopAll();
            }
            return null;
          });
        }
      },
      (err) => {
        console.warn('Incoming call listener warning:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, activeCall, soundEnabled]);

  // Duration timer when connected
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      const startTime = activeCall.connectedAt || Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [activeCall?.status, activeCall?.connectedAt]);

  // START OUTGOING CALL
  const startCall = async (receiver: UserProfile, type: CallType) => {
    if (!user?.uid) return;
    cleanupMediaAndPeer();

    try {
      if (soundEnabled) {
        audioService.startOutgoingDialTone();
      }

      // 1. Get user media
      let stream: MediaStream;
      try {
        stream = await getUserMediaStream(type, facingMode);
      } catch (err: any) {
        audioService.stopAll();
        addToast({
          title: 'Permission Denied',
          message: `${type === 'video' ? 'Camera & Microphone' : 'Microphone'} access is required.`,
          type: 'error',
        });
        return;
      }

      setLocalStream(stream);

      // 2. Setup RTCPeerConnection
      const pc = new RTCPeerConnection(getRtcConfiguration());
      peerConnectionRef.current = pc;

      // Remote track listener
      const rStream = new MediaStream();
      setRemoteStream(rStream);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          rStream.addTrack(track);
        });
      };

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 3. Create Firestore Call Document
      const callDocRef = doc(collection(db, 'calls'));
      const callId = callDocRef.id;

      const callSession: CallSession = {
        callId,
        callerId: user.uid,
        callerName: user.displayName || 'User',
        callerPhoto: user.photoURL || '',
        receiverId: receiver.uid,
        receiverName: receiver.displayName,
        receiverPhoto: receiver.photoURL || '',
        type,
        status: 'calling',
        startedAt: Date.now(),
      };

      setActiveCall(callSession);

      // ICE candidates from caller
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(collection(db, 'calls', callId, 'callerCandidates'), event.candidate.toJSON());
          } catch (e) {}
        }
      };

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      callSession.offer = {
        type: offer.type,
        sdp: offer.sdp,
      };

      await setDoc(callDocRef, callSession);

      // Send in-app notification to receiver
      await addDoc(collection(db, 'notifications'), {
        userId: receiver.uid,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: user.photoURL,
        type: type === 'video' ? 'incoming_video' : 'incoming_voice',
        title: `Incoming ${type} call`,
        body: `${user.displayName} is calling you`,
        data: { callId },
        read: false,
        createdAt: Date.now(),
      });

      // Listen for Answer and Call Status
      callUnsubRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data() as CallSession | undefined;
        if (!data) return;

        if (data.status === 'busy') {
          audioService.playCallEnded();
          addToast({
            title: 'User Busy',
            message: `${receiver.displayName} is currently on another call.`,
            type: 'warning',
          });
          endCall();
        } else if (data.status === 'rejected') {
          audioService.playCallEnded();
          addToast({
            title: 'Call Declined',
            message: `${receiver.displayName} declined the call.`,
            type: 'info',
          });
          logCallSummary(data, 'rejected', 0);
          endCall();
        } else if (data.status === 'ended') {
          audioService.playCallEnded();
          endCall();
        } else if (data.status === 'connected' && data.answer && !pc.currentRemoteDescription) {
          audioService.playCallConnected();
          const rtcAnswer = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(rtcAnswer);
          setActiveCall((prev) => (prev ? { ...prev, status: 'connected', connectedAt: data.connectedAt || Date.now() } : null));
        }
      });

      // Listen for receiver's ICE candidates
      candidateUnsubRef.current = onSnapshot(
        collection(db, 'calls', callId, 'receiverCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              try {
                await pc.addIceCandidate(candidate);
              } catch (e) {}
            }
          });
        }
      );

      // Auto-missed timeout (45s)
      callTimeoutRef.current = window.setTimeout(async () => {
        if (activeCall?.status === 'calling') {
          audioService.playCallEnded();
          addToast({
            title: 'No Answer',
            message: `${receiver.displayName} is unavailable.`,
            type: 'info',
          });
          await updateDoc(callDocRef, { status: 'missed', endedAt: Date.now() });
          logCallSummary(callSession, 'missed', 0);
          endCall();
        }
      }, 45000);
    } catch (err: any) {
      console.error('Call initiation error:', err);
      audioService.stopAll();
      addToast({
        title: 'Call Failed',
        message: 'Unable to connect the call. Please check your network connection.',
        type: 'error',
      });
      cleanupMediaAndPeer();
      setActiveCall(null);
    }
  };

  // ACCEPT INCOMING CALL
  const acceptCall = async () => {
    if (!incomingCall || !user?.uid) return;
    const session = incomingCall;
    setIncomingCall(null);
    audioService.stopAll();

    try {
      // 1. Get media
      let stream: MediaStream;
      try {
        stream = await getUserMediaStream(session.type, facingMode);
      } catch (err: any) {
        addToast({
          title: 'Permission Denied',
          message: `${session.type === 'video' ? 'Camera & Microphone' : 'Microphone'} access is required.`,
          type: 'error',
        });
        await updateDoc(doc(db, 'calls', session.callId), { status: 'failed' });
        return;
      }

      setLocalStream(stream);

      // 2. Setup RTCPeerConnection
      const pc = new RTCPeerConnection(getRtcConfiguration());
      peerConnectionRef.current = pc;

      const rStream = new MediaStream();
      setRemoteStream(rStream);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          rStream.addTrack(track);
        });
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const callDocRef = doc(db, 'calls', session.callId);

      // ICE candidates from receiver
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(collection(db, 'calls', session.callId, 'receiverCandidates'), event.candidate.toJSON());
          } catch (e) {}
        }
      };

      // Set Remote Description from offer
      if (session.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(session.offer));
      }

      // Create Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const now = Date.now();
      const updatedSession: CallSession = {
        ...session,
        status: 'connected',
        connectedAt: now,
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      };

      setActiveCall(updatedSession);
      audioService.playCallConnected();

      await updateDoc(callDocRef, {
        status: 'connected',
        connectedAt: now,
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      // Listen for caller candidates
      candidateUnsubRef.current = onSnapshot(
        collection(db, 'calls', session.callId, 'callerCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              try {
                await pc.addIceCandidate(candidate);
              } catch (e) {}
            }
          });
        }
      );

      // Listen for call termination
      callUnsubRef.current = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data() as CallSession | undefined;
        if (data && (data.status === 'ended' || data.status === 'rejected')) {
          audioService.playCallEnded();
          endCall();
        }
      });
    } catch (err) {
      console.error('Accept call error:', err);
      addToast({
        title: 'Connection Error',
        message: 'Unable to establish call connection.',
        type: 'error',
      });
      cleanupMediaAndPeer();
      setActiveCall(null);
    }
  };

  // REJECT INCOMING CALL
  const rejectCall = async () => {
    if (!incomingCall) return;
    const session = incomingCall;
    setIncomingCall(null);
    audioService.stopAll();

    try {
      const callDocRef = doc(db, 'calls', session.callId);
      await updateDoc(callDocRef, {
        status: 'rejected',
        endedAt: Date.now(),
      });
      logCallSummary(session, 'rejected', 0);
    } catch (e) {
      console.warn('Reject call error:', e);
    }
  };

  // END / HANG UP ACTIVE CALL
  const endCall = async () => {
    const session = activeCall;
    const duration = callDuration;

    cleanupMediaAndPeer();
    setActiveCall(null);

    if (session) {
      try {
        const callDocRef = doc(db, 'calls', session.callId);
        await updateDoc(callDocRef, {
          status: 'ended',
          endedAt: Date.now(),
          duration,
        });
        logCallSummary(session, 'ended', duration);
      } catch (e) {
        console.warn('End call error:', e);
      }
    }
  };

  // TOGGLE AUDIO MUTE
  const toggleAudioMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // TOGGLE VIDEO MUTE
  const toggleVideoMute = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // TOGGLE SPEAKER / AUDIO OUTPUT
  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // FLIP FRONT / BACK CAMERA
  const flipCamera = async () => {
    if (!localStream || activeCall?.type !== 'video') return;

    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    try {
      const newStream = await getUserMediaStream('video', nextMode);
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (peerConnectionRef.current && newVideoTrack) {
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');

        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }

        // Replace track in localStream
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          localStream.removeTrack(oldVideoTrack);
        }
        localStream.addTrack(newVideoTrack);
      }
    } catch (e) {
      console.warn('Flip camera error:', e);
    }
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        callDuration,
        isAudioMuted,
        isVideoMuted,
        isSpeakerOn,
        facingMode,
        callQuality,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleAudioMute,
        toggleVideoMute,
        toggleSpeaker,
        flipCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
