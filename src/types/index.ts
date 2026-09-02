export interface PrivacySettings {
  onlineStatus: 'everyone' | 'nobody';
  lastSeen: 'everyone' | 'nobody';
  readReceipts?: boolean;
  typingIndicator?: boolean;
  showPreview?: boolean;
}

export interface UserNotificationSettings {
  messages: boolean;
  incomingCalls: boolean;
  missedCalls: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface PushTokenRecord {
  id: string; // token hash or document id
  userId: string;
  token: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string;
  os: string;
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  isActive: boolean;
}

export interface PushNotificationPayload {
  type: 'message' | 'incoming_call' | 'missed_call' | 'call_cancelled';
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  messageId?: string;
  messageText?: string;
  callId?: string;
  callerId?: string;
  callerName?: string;
  callerPhoto?: string;
  callType?: 'voice' | 'video';
  timestamp?: string | number;
  clickAction?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL: string;
  isOnline: boolean;
  lastSeen: number; // epoch ms
  createdAt: number; // epoch ms
  updatedAt?: number;
  bio?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  customStatus?: string;
  favorites?: string[]; // array of contact UIDs
  pinnedChats?: string[]; // array of conversation IDs
  mutedChats?: Record<string, number>; // conversationId -> mutedUntil epoch ms
  privacySettings?: PrivacySettings;
  notificationSettings?: UserNotificationSettings;
}

export type MessageType = 'text' | 'voice_call' | 'video_call' | 'voice_message' | 'image';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  text: string;
  type: MessageType;
  audioUrl?: string;
  audioDuration?: number; // seconds
  imageUrl?: string;
  imageCaption?: string;
  callDuration?: number; // in seconds
  callStatus?: 'connected' | 'missed' | 'rejected' | 'ended' | 'busy';
  timestamp: number; // epoch ms
  delivered: boolean;
  deliveredAt?: number;
  read: boolean;
  readAt?: number;
}

export interface Conversation {
  id: string;
  participants: string[]; // [uid1, uid2]
  participantData: Record<string, {
    displayName: string;
    username: string;
    photoURL: string;
    isOnline?: boolean;
    lastSeen?: number;
  }>;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName?: string;
    timestamp: number;
    type: MessageType;
    callDuration?: number;
    callStatus?: string;
    audioDuration?: number;
    hasImage?: boolean;
  };
  unreadCount: Record<string, number>; // uid -> count
  typing: Record<string, boolean | 'typing' | 'recording'>; // uid -> typing/recording state
  pinnedBy?: string[]; // array of uids who pinned this chat
  mutedBy?: Record<string, number>; // uid -> mutedUntil epoch ms
  updatedAt: number;
  createdAt: number;
}

export type CallType = 'voice' | 'video';

export type CallStatus =
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'ended'
  | 'missed'
  | 'busy'
  | 'failed';

export interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit | null;
  answer?: RTCSessionDescriptionInit | null;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  duration?: number; // seconds
}

export interface AppNotification {
  id: string;
  userId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  type: 'message' | 'incoming_voice' | 'incoming_video' | 'missed_call';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: number;
}

export type ActiveTab = 'chats' | 'calls' | 'notifications' | 'profile';
