/**
 * Jiya Chat - Firebase Cloud Messaging & Web Push Service Worker
 * Handles background push notifications, WebRTC incoming calls, and click actions.
 */

// Import Firebase compat scripts for service worker environment
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Self-contained default configuration
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAsMhRBOf3M0Fj9mT5Bbaoe-KSuVJ1wZ-w",
  authDomain: "model-kingdom-zwh20.firebaseapp.com",
  projectId: "model-kingdom-zwh20",
  storageBucket: "model-kingdom-zwh20.firebasestorage.app",
  messagingSenderId: "369321128702",
  appId: "1:369321128702:web:ed91185f6e16a75c0f6baf",
};

try {
  firebase.initializeApp(defaultFirebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase onBackgroundMessage received:', payload);
    return handlePushPayload(payload.data || payload);
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging initialization fallback:', e);
}

// Global push event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    try {
      payload = { data: { messageText: event.data.text() } };
    } catch (err) {
      return;
    }
  }

  const data = payload.data || payload;
  event.waitUntil(handlePushPayload(data, payload.notification));
});

/**
 * Handle different push notification types: message, incoming_call, missed_call, call_cancelled
 */
async function handlePushPayload(data, notificationOverride) {
  const type = data.type || 'message';

  // 1. Call Cancelled / Caller Hung Up -> Dismiss the ringing notification immediately
  if (type === 'call_cancelled' && data.callId) {
    const existingNotifications = await self.registration.getNotifications({
      tag: `call_${data.callId}`,
    });
    existingNotifications.forEach((n) => n.close());
    return;
  }

  // 2. Incoming Audio / Video Call
  if (type === 'incoming_call') {
    const callId = data.callId || `call_${Date.now()}`;
    const callerName = data.callerName || 'Someone';
    const callType = data.callType === 'video' ? 'video' : 'voice';
    const callerPhoto = data.callerPhoto || '/pwa-192x192.png';

    const title = `Incoming ${callType} call from ${callerName}`;
    const options = {
      body: `${callerName} is calling you on Jiya`,
      icon: callerPhoto,
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
        callerId: data.callerId,
        callerName,
        callType,
        url: `/call/${callId}`,
      },
    };

    return self.registration.showNotification(title, options);
  }

  // 3. Missed Call Notification
  if (type === 'missed_call') {
    const callId = data.callId || '';
    const callerName = data.callerName || 'Someone';
    const callType = data.callType === 'video' ? 'video' : 'voice';

    // Close any lingering incoming call notification for this call
    if (callId) {
      const activeCalls = await self.registration.getNotifications({
        tag: `call_${callId}`,
      });
      activeCalls.forEach((n) => n.close());
    }

    const title = `Missed ${callType} call from ${callerName}`;
    const options = {
      body: `Tap to open Jiya chat with ${callerName}`,
      icon: data.callerPhoto || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `missed_${callId || Date.now()}`,
      vibrate: [200, 100, 200],
      data: {
        type: 'missed_call',
        conversationId: data.conversationId,
        senderId: data.callerId,
        url: data.conversationId ? `/chat/${data.conversationId}` : '/',
      },
    };

    return self.registration.showNotification(title, options);
  }

  // 4. Standard Chat Message Notification
  const senderName = data.senderName || (notificationOverride && notificationOverride.title) || 'New message';
  const messageText = data.messageText || data.body || (notificationOverride && notificationOverride.body) || 'Sent you a message';
  const conversationId = data.conversationId || 'default';
  const senderId = data.senderId || '';
  const senderPhoto = data.senderPhoto || (notificationOverride && notificationOverride.icon) || '/pwa-192x192.png';

  // Intelligent Duplicate Prevention: Check if client is already open and actively focused on this chat
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  const isChatCurrentlyActiveInForeground = windowClients.some((client) => {
    return client.focused && client.url.includes(conversationId);
  });

  if (isChatCurrentlyActiveInForeground) {
    // Receiver is actively reading the conversation; avoid spamming with system notification
    return;
  }

  // Check for existing notifications with this conversation tag for WhatsApp-like grouping
  const existingNotifications = await self.registration.getNotifications({
    tag: `msg_${conversationId}`,
  });

  let displayTitle = `New message from ${senderName}`;
  let displayBody = messageText;
  let messageCount = 1;

  if (existingNotifications.length > 0) {
    const existing = existingNotifications[0];
    const prevCount = (existing.data && existing.data.messageCount) || 1;
    messageCount = prevCount + 1;
    displayTitle = senderName;
    displayBody = `${messageCount} new messages`;
  }

  const options = {
    body: displayBody,
    icon: senderPhoto,
    badge: '/pwa-192x192.png',
    tag: `msg_${conversationId}`,
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      type: 'message',
      conversationId,
      senderId,
      senderName,
      messageCount,
      url: `/chat/${conversationId}`,
    },
  };

  // Update App Badge if supported
  if ('setAppBadge' in self.navigator) {
    try {
      const allActive = await self.registration.getNotifications();
      const unreadCount = allActive.filter((n) => n.tag && n.tag.startsWith('msg_')).length + 1;
      self.navigator.setAppBadge(unreadCount).catch(() => {});
    } catch (e) {}
  }

  return self.registration.showNotification(displayTitle, options);
}

// Notification Click Handler: Focus existing tab or open new window & route to chat/call
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    (async () => {
      // Broadcast action to clients
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Handle Call Decline button action directly
      if (action === 'decline' && notifData.callId) {
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'REJECT_INCOMING_CALL',
            callId: notifData.callId,
          });
        });
        return;
      }

      // Handle Call Accept button or general notification tap
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action,
            data: notifData,
          });
          return;
        }
      }

      // If no open tab is found, open a fresh window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  // Can be used to track analytics or dismiss related items
});

// Install and activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
