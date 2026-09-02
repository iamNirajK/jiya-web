import React from 'react';
import { ChatMessage, CallType } from '../../types';
import { AudioPlayer } from './AudioPlayer';
import {
  Check,
  CheckCheck,
  Phone,
  Video,
  PhoneMissed,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';

interface MessageBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
  searchQuery?: string;
  onRedialCall?: (type: CallType) => void;
  onImageClick?: (imageUrl: string, caption?: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSelf,
  searchQuery = '',
  onRedialCall,
  onImageClick,
}) => {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to highlight matching search term
  const renderHighlightedText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-300 dark:bg-yellow-500/80 text-black px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Special UI for call logs
  if (message.type === 'voice_call' || message.type === 'video_call') {
    const isVideo = message.type === 'video_call';
    const isMissed =
      message.callStatus === 'missed' ||
      message.callStatus === 'rejected' ||
      message.callStatus === 'busy';

    return (
      <div className="flex justify-center my-2 select-none">
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs max-w-xs">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isMissed
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {isVideo ? (
              <Video className="w-3.5 h-3.5" />
            ) : isMissed ? (
              <PhoneMissed className="w-3.5 h-3.5" />
            ) : (
              <Phone className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-semibold ${
                isMissed ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {message.text}
            </p>
            <span className="text-[10px] text-slate-400">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {onRedialCall && (
            <button
              onClick={() => onRedialCall(isVideo ? 'video' : 'voice')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
              title="Call Back"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Voice Message Bubble
  if (message.type === 'voice_message' && message.audioUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col my-1 select-none ${isSelf ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl relative ${
            isSelf
              ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-200 dark:shadow-none'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
          }`}
        >
          <AudioPlayer
            audioUrl={message.audioUrl}
            durationSec={message.audioDuration || 0}
            isSelf={isSelf}
          />

          <div
            className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${
              isSelf ? 'text-indigo-200' : 'text-slate-400'
            }`}
          >
            <span>{formatTime(message.timestamp)}</span>
            {isSelf && (
              <span className="inline-flex items-center ml-0.5">
                {message.read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" title="Read" />
                ) : message.delivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-300/80" title="Delivered" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-indigo-300/80" title="Sent" />
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Image Message Bubble
  if (message.type === 'image' && message.imageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col my-1 select-none ${isSelf ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`max-w-[78%] p-1.5 rounded-2xl relative ${
            isSelf
              ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-200 dark:shadow-none'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
          }`}
        >
          <div
            onClick={() => onImageClick?.(message.imageUrl!, message.imageCaption || message.text)}
            className="cursor-pointer overflow-hidden rounded-xl bg-slate-950/10 group relative"
          >
            <img
              src={message.imageUrl}
              alt="Sent attachment"
              className="max-h-64 w-full object-cover rounded-xl group-hover:scale-102 transition-transform duration-200"
            />
          </div>

          {(message.imageCaption || (message.text && message.text !== '📷 Photo')) && (
            <p className="px-2 pt-1.5 pb-0.5 text-xs select-text leading-relaxed">
              {renderHighlightedText(message.imageCaption || message.text)}
            </p>
          )}

          <div
            className={`flex items-center justify-end gap-1 px-2 pb-0.5 text-[10px] ${
              isSelf ? 'text-indigo-200' : 'text-slate-400'
            }`}
          >
            <span>{formatTime(message.timestamp)}</span>
            {isSelf && (
              <span className="inline-flex items-center ml-0.5">
                {message.read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" title="Read" />
                ) : message.delivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-300/80" title="Delivered" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-indigo-300/80" title="Sent" />
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Standard Text Message Bubble
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col my-1 select-none ${isSelf ? 'items-end' : 'items-start'}`}
    >
      <div
        className={`max-w-[78%] px-4 py-2.5 rounded-2xl relative break-words text-xs sm:text-sm leading-relaxed ${
          isSelf
            ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-200 dark:shadow-none'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
        }`}
      >
        <p className="whitespace-pre-wrap select-text">
          {renderHighlightedText(message.text)}
        </p>

        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isSelf ? 'text-indigo-200' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isSelf && (
            <span className="inline-flex items-center ml-0.5">
              {message.read ? (
                <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" title="Read" />
              ) : message.delivered ? (
                <CheckCheck className="w-3.5 h-3.5 text-indigo-300/80" title="Delivered" />
              ) : (
                <Check className="w-3.5 h-3.5 text-indigo-300/80" title="Sent" />
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
