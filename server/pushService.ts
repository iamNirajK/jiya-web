import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging, MulticastMessage } from 'firebase-admin/messaging';
import configJson from '../firebase-applet-config.json';

let adminApp: App | null = null;

/**
 * Lazily initialize Firebase Admin SDK
 */
export function getFirebaseAdmin(): App | null {
  if (adminApp && getApps().length > 0) {
    return adminApp;
  }

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      return adminApp;
    }

    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      configJson.projectId;

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } else {
      // Initialize with default application credentials or project ID
      adminApp = initializeApp({
        projectId,
      });
    }

    return adminApp;
  } catch (err) {
    console.warn('[ServerPush] Firebase Admin SDK lazy initialization notice:', err);
    return null;
  }
}

/**
 * Get Firestore instance for backend token operations
 */
export function getAdminDb(): Firestore | null {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    const dbId =
      process.env.FIREBASE_DATABASE_ID ||
      process.env.VITE_FIREBASE_DATABASE_ID ||
      configJson.firestoreDatabaseId;

    if (dbId && dbId !== '(default)') {
      return getFirestore(app, dbId);
    }
    return getFirestore(app);
  } catch (e) {
    return getFirestore(app);
  }
}

/**
 * Get Messaging instance
 */
export function getAdminMessaging(): Messaging | null {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (e) {
    return null;
  }
}

/**
 * Register or update device push token in Firestore
 */
export async function registerPushToken(data: {
  userId: string;
  token: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  userAgent?: string;
}) {
  const { userId, token, deviceType = 'unknown', browser = 'Browser', os = 'OS', userAgent = '' } = data;
  if (!userId || !token) {
    throw new Error('userId and token are required');
  }

  const db = getAdminDb();
  if (!db) {
    return { success: true, warning: 'Admin DB not initialized' };
  }

  const now = Date.now();
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  const tokenHash = Math.abs(hash).toString(36);
  const docId = `${userId}_${tokenHash}`;

  await db.collection('push_tokens').doc(docId).set(
    {
      id: docId,
      userId,
      token,
      deviceType,
      browser,
      os,
      userAgent,
      updatedAt: now,
      lastSeenAt: now,
      isActive: true,
      createdAt: now,
    },
    { merge: true }
  );

  return { success: true, docId };
}

/**
 * Unregister device token
 */
export async function unregisterPushToken(data: { userId: string; token: string }) {
  const { userId, token } = data;
  const db = getAdminDb();
  if (!db || !userId || !token) return { success: true };

  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  const tokenHash = Math.abs(hash).toString(36);
  const docId = `${userId}_${tokenHash}`;

  await db.collection('push_tokens').doc(docId).update({
    isActive: false,
    updatedAt: Date.now(),
  }).catch(() => {});

  return { success: true };
}

/**
 * Helper to fetch active tokens for a specific user
 */
async function getUserActiveTokens(userId: string): Promise<string[]> {
  const db = getAdminDb();
  if (!db || !userId) return [];

  try {
    const snap = await db
      .collection('push_tokens')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const tokens: string[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    return Array.from(new Set(tokens));
  } catch (err) {
    console.warn('[ServerPush] Get user tokens error:', err);
    return [];
  }
}

/**
 * Helper to deactivate invalid/unregistered tokens
 */
async function cleanupInvalidTokens(tokens: string[]) {
  if (!tokens || tokens.length === 0) return;
  const db = getAdminDb();
  if (!db) return;

  for (const token of tokens) {
    try {
      const snap = await db.collection('push_tokens').where('token', '==', token).get();
      snap.forEach((d) => {
        d.ref.update({ isActive: false, deactivatedAt: Date.now() }).catch(() => {});
      });
    } catch (e) {}
  }
}

/**
 * Send Message Push Notification
 */
export async function sendMessagePush(payload: {
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  conversationId: string;
  messageText: string;
  messageType?: string;
  messageId?: string;
}) {
  const {
    senderId,
    senderName,
    senderPhoto = '',
    receiverId,
    conversationId,
    messageText,
    messageType = 'text',
    messageId = '',
  } = payload;

  const messaging = getAdminMessaging();
  if (!messaging) return { success: false, reason: 'Firebase Admin Messaging not ready' };

  const tokens = await getUserActiveTokens(receiverId);
  if (tokens.length === 0) {
    return { success: true, deliveredCount: 0, note: 'No active device tokens found for receiver' };
  }

  const messagePayload: MulticastMessage = {
    tokens,
    notification: {
      title: `New message from ${senderName}`,
      body: messageText || 'Sent you a message',
    },
    data: {
      type: 'message',
      conversationId,
      senderId,
      senderName,
      senderPhoto,
      messageId,
      messageText,
      messageType,
      timestamp: String(Date.now()),
      url: `/chat/${conversationId}`,
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: `New message from ${senderName}`,
        body: messageText || 'Sent you a message',
        icon: senderPhoto || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `msg_${conversationId}`,
        renotify: true,
        vibrate: [150, 80, 150],
        data: {
          type: 'message',
          conversationId,
          senderId,
          senderName,
          url: `/chat/${conversationId}`,
        },
      },
      fcmOptions: {
        link: `/chat/${conversationId}`,
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(messagePayload);
    const failedTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    if (failedTokens.length > 0) {
      await cleanupInvalidTokens(failedTokens);
    }

    return {
      success: true,
      deliveredCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.warn('[ServerPush] Send multicast message notice:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send Incoming Call Push Notification
 */
export async function sendIncomingCallPush(payload: {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  callType: 'voice' | 'video';
}) {
  const { callId, callerId, callerName, callerPhoto = '', receiverId, callType } = payload;
  const messaging = getAdminMessaging();
  if (!messaging) return { success: false, reason: 'Firebase Admin Messaging not ready' };

  const tokens = await getUserActiveTokens(receiverId);
  if (tokens.length === 0) {
    return { success: true, deliveredCount: 0, note: 'No active tokens for call receiver' };
  }

  const callMessage: MulticastMessage = {
    tokens,
    notification: {
      title: `Incoming ${callType} call from ${callerName}`,
      body: `${callerName} is calling you on Jiya`,
    },
    data: {
      type: 'incoming_call',
      callId,
      callerId,
      callerName,
      callerPhoto,
      callType,
      timestamp: String(Date.now()),
      url: `/call/${callId}`,
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '45',
      },
      notification: {
        title: `Incoming ${callType} call from ${callerName}`,
        body: `${callerName} is calling you on Jiya`,
        icon: callerPhoto || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `call_${callId}`,
        requireInteraction: true,
        renotify: true,
        vibrate: [300, 100, 300, 100, 300, 100, 300],
        actions: [
          { action: 'accept', title: '🟢 Accept' },
          { action: 'decline', title: '🔴 Decline' },
        ],
        data: {
          type: 'incoming_call',
          callId,
          callerId,
          callerName,
          callType,
          url: `/call/${callId}`,
        },
      },
      fcmOptions: {
        link: `/call/${callId}`,
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(callMessage);
    return {
      success: true,
      deliveredCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.warn('[ServerPush] Send incoming call push error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send Missed Call Push Notification
 */
export async function sendMissedCallPush(payload: {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  callType: 'voice' | 'video';
  conversationId?: string;
}) {
  const { callId, callerId, callerName, callerPhoto = '', receiverId, callType, conversationId = '' } = payload;
  const messaging = getAdminMessaging();
  if (!messaging) return { success: false };

  const tokens = await getUserActiveTokens(receiverId);
  if (tokens.length === 0) return { success: true, deliveredCount: 0 };

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: `Missed ${callType} call from ${callerName}`,
      body: `Tap to open Jiya chat with ${callerName}`,
    },
    data: {
      type: 'missed_call',
      callId,
      callerId,
      callerName,
      callerPhoto,
      callType,
      conversationId,
      url: conversationId ? `/chat/${conversationId}` : '/',
    },
    webpush: {
      headers: {
        Urgency: 'normal',
      },
      notification: {
        title: `Missed ${callType} call from ${callerName}`,
        body: `Tap to open Jiya chat with ${callerName}`,
        icon: callerPhoto || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `missed_${callId}`,
        vibrate: [200, 100, 200],
        data: {
          type: 'missed_call',
          conversationId,
          url: conversationId ? `/chat/${conversationId}` : '/',
        },
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    return { success: true, deliveredCount: response.successCount };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send Call Cancelled Push (Dismisses ringing notification on receiver devices)
 */
export async function sendCallCancelledPush(payload: { callId: string; receiverId: string }) {
  const { callId, receiverId } = payload;
  const messaging = getAdminMessaging();
  if (!messaging) return { success: false };

  const tokens = await getUserActiveTokens(receiverId);
  if (tokens.length === 0) return { success: true, deliveredCount: 0 };

  const dataOnlyMessage: MulticastMessage = {
    tokens,
    data: {
      type: 'call_cancelled',
      callId,
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '0',
      },
    },
  };

  try {
    await messaging.sendEachForMulticast(dataOnlyMessage);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
