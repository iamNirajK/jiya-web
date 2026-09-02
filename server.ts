import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  registerPushToken,
  unregisterPushToken,
  sendMessagePush,
  sendIncomingCallPush,
  sendMissedCallPush,
  sendCallCancelledPush,
} from './server/pushService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1. Register Device Push Token
  app.post('/api/push/register-token', async (req, res) => {
    try {
      const { userId, token, deviceType, browser, os, userAgent } = req.body;
      if (!userId || !token) {
        return res.status(400).json({ error: 'Missing userId or token' });
      }

      const result = await registerPushToken({
        userId,
        token,
        deviceType,
        browser,
        os,
        userAgent,
      });

      res.json({ success: true, result });
    } catch (err: any) {
      console.error('[API] Register token error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 2. Unregister Device Push Token
  app.post('/api/push/unregister-token', async (req, res) => {
    try {
      const { userId, token } = req.body;
      if (!userId || !token) {
        return res.status(400).json({ error: 'Missing userId or token' });
      }

      const result = await unregisterPushToken({ userId, token });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 3. Send Message Push Notification
  app.post('/api/push/send-message', async (req, res) => {
    try {
      const {
        senderId,
        senderName,
        senderPhoto,
        receiverId,
        conversationId,
        messageText,
        messageType,
        messageId,
      } = req.body;

      if (!senderId || !receiverId || !conversationId) {
        return res.status(400).json({ error: 'Missing required message parameters' });
      }

      const result = await sendMessagePush({
        senderId,
        senderName: senderName || 'User',
        senderPhoto,
        receiverId,
        conversationId,
        messageText: messageText || '',
        messageType: messageType || 'text',
        messageId,
      });

      res.json(result);
    } catch (err: any) {
      console.error('[API] Send message push error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 4. Send Incoming Call Push Notification
  app.post('/api/push/send-call', async (req, res) => {
    try {
      const { callId, callerId, callerName, callerPhoto, receiverId, callType } = req.body;
      if (!callId || !callerId || !receiverId) {
        return res.status(400).json({ error: 'Missing required call parameters' });
      }

      const result = await sendIncomingCallPush({
        callId,
        callerId,
        callerName: callerName || 'User',
        callerPhoto,
        receiverId,
        callType: callType || 'voice',
      });

      res.json(result);
    } catch (err: any) {
      console.error('[API] Send call push error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 5. Send Missed Call Push Notification
  app.post('/api/push/send-missed-call', async (req, res) => {
    try {
      const { callId, callerId, callerName, callerPhoto, receiverId, callType, conversationId } = req.body;
      if (!callId || !callerId || !receiverId) {
        return res.status(400).json({ error: 'Missing required missed call parameters' });
      }

      const result = await sendMissedCallPush({
        callId,
        callerId,
        callerName: callerName || 'User',
        callerPhoto,
        receiverId,
        callType: callType || 'voice',
        conversationId,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 6. Send Call Cancelled (Dismiss Ringing Notification)
  app.post('/api/push/send-call-cancelled', async (req, res) => {
    try {
      const { callId, receiverId } = req.body;
      if (!callId || !receiverId) {
        return res.status(400).json({ error: 'Missing callId or receiverId' });
      }

      const result = await sendCallCancelledPush({ callId, receiverId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 7. Send Test Push Notification
  app.post('/api/push/test', async (req, res) => {
    try {
      const { userId, displayName } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      const result = await sendMessagePush({
        senderId: 'system',
        senderName: 'Jiya Notification Bot',
        senderPhoto: '/pwa-192x192.png',
        receiverId: userId,
        conversationId: 'test',
        messageText: `🎉 Push notifications are working perfectly on your device, ${displayName || 'User'}!`,
        messageType: 'text',
      });

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jiya Chat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
