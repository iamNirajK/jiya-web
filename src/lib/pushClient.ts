import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { app, db, doc, setDoc, updateDoc, collection, query, where, getDocs } from './firebase';
import { PushNotificationPayload, PushTokenRecord } from '../types';

let messagingInstance: Messaging | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

// Get VAPID public key from env or standard default
export const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuYHIqdNpnt40gNH6sNjG63NVg';

/**
 * Detect client device information
 */
export function getDeviceInfo(): {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string;
  os: string;
  userAgent: string;
} {
  const ua = navigator.userAgent || '';
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'desktop';

  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('like Mac')) os = 'iOS';

  return { deviceType, browser, os, userAgent: ua };
}

/**
 * Register the dedicated Firebase Messaging Service Worker
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (swRegistration) {
    return swRegistration;
  }

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('[PushClient] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Initialize Firebase Cloud Messaging safely
 */
export async function getMessagingClient(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.info('[PushClient] Firebase Messaging not supported in this browser environment.');
      return null;
    }

    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[PushClient] Failed to initialize Firebase Messaging:', err);
    return null;
  }
}

/**
 * Hash helper for clean doc IDs
 */
function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const chr = token.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Request Notification Permission and register FCM Token to Firestore and Server
 */
export async function requestAndRegisterFCMToken(userId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const swReg = await registerPushServiceWorker();
    const messaging = await getMessagingClient();
    if (!messaging || !swReg) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return null;

    // Register token in Firestore and backend
    await saveDevicePushToken(userId, token);

    return token;
  } catch (err) {
    console.warn('[PushClient] FCM token generation error:', err);
    return null;
  }
}

/**
 * Save device push token to Firestore and API endpoint
 */
export async function saveDevicePushToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;

  const now = Date.now();
  const info = getDeviceInfo();
  const tokenHash = hashToken(token);
  const docId = `${userId}_${tokenHash}`;

  const tokenRecord: PushTokenRecord = {
    id: docId,
    userId,
    token,
    deviceType: info.deviceType,
    browser: info.browser,
    os: info.os,
    userAgent: info.userAgent,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    isActive: true,
  };

  // 1. Direct Firestore write
  try {
    await setDoc(doc(db, 'push_tokens', docId), tokenRecord, { merge: true });
  } catch (e) {
    console.warn('[PushClient] Firestore token write fallback:', e);
  }

  // 2. Call backend endpoint
  try {
    await fetch('/api/push/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        token,
        deviceType: info.deviceType,
        browser: info.browser,
        os: info.os,
        userAgent: info.userAgent,
      }),
    });
  } catch (e) {
    // Non-blocking network catch
  }
}

/**
 * Unregister device push token (e.g. on user logout or notifications disabled)
 */
export async function unregisterDevicePushToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;

  const tokenHash = hashToken(token);
  const docId = `${userId}_${tokenHash}`;

  try {
    await updateDoc(doc(db, 'push_tokens', docId), {
      isActive: false,
      updatedAt: Date.now(),
    });
  } catch (e) {}

  try {
    await fetch('/api/push/unregister-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    });
  } catch (e) {}
}

/**
 * Listen for foreground push messages
 */
export function listenToForegroundMessages(
  onReceive: (payload: PushNotificationPayload) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getMessagingClient().then((messaging) => {
    if (!messaging) return;
    try {
      unsubscribe = onMessage(messaging, (payload) => {
        const data = (payload.data || {}) as unknown as PushNotificationPayload;
        onReceive(data);
      });
    } catch (e) {
      console.warn('[PushClient] onMessage setup notice:', e);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

/**
 * Backend Notification Dispatchers (Securely proxies through full-stack backend)
 */
export async function triggerPushMessageNotification(payload: {
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  conversationId: string;
  messageText: string;
  messageType?: string;
  messageId?: string;
}): Promise<void> {
  try {
    await fetch('/api/push/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[PushClient] Push message dispatch notice:', e);
  }
}

export async function triggerPushCallNotification(payload: {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  callType: 'voice' | 'video';
}): Promise<void> {
  try {
    await fetch('/api/push/send-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[PushClient] Push call dispatch notice:', e);
  }
}

export async function triggerPushCallCancelled(payload: {
  callId: string;
  receiverId: string;
}): Promise<void> {
  try {
    await fetch('/api/push/send-call-cancelled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[PushClient] Push call cancel dispatch notice:', e);
  }
}

export async function triggerPushMissedCall(payload: {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  callType: 'voice' | 'video';
  conversationId?: string;
}): Promise<void> {
  try {
    await fetch('/api/push/send-missed-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[PushClient] Push missed call dispatch notice:', e);
  }
}
