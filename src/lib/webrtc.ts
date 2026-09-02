import {
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  getDoc,
  getDocs,
} from './firebase';
import { CallType, CallStatus, CallSession } from '../types';

export function getRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_SERVER_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnPass = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: turnUser || undefined,
      credential: turnPass || undefined,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
  };
}

export async function getUserMediaStream(
  type: CallType,
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Media devices are not supported on this browser/device.');
  }

  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (type === 'voice') {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
  } else {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: {
        facingMode,
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (e) {
      console.warn('Track stop error:', e);
    }
  });
}
