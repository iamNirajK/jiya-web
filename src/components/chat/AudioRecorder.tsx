import React, { useState, useRef, useEffect } from 'react';
import { Mic, Trash2, Send, StopCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface AudioRecorderProps {
  onSend: (audioUrl: string, durationSec: number) => void;
  onCancel: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSend, onCancel }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(100);
        setIsRecording(true);

        timerRef.current = window.setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Audio recording failed to start:', err);
        onCancel();
      }
    }

    startRecording();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleFinishAndSend = () => {
    if (!mediaRecorderRef.current) return;
    const duration = Math.max(1, recordingTime);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        onSend(base64data, duration);
      };
      reader.readAsDataURL(audioBlob);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };

    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleDiscard = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onCancel();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-3 w-full bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/40"
    >
      {/* Red pulse recording indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
          {formatTimer(recordingTime)}
        </span>
      </div>

      {/* Animated Waveform Visualizer */}
      <div className="flex-1 flex items-center justify-center gap-0.5 h-6 overflow-hidden">
        {[40, 70, 30, 90, 50, 80, 100, 60, 45, 85, 35, 75, 55, 95, 40].map((h, i) => (
          <motion.span
            key={i}
            animate={{ height: ['20%', `${h}%`, '20%'] }}
            transition={{
              repeat: Infinity,
              duration: 0.8 + (i % 3) * 0.2,
              ease: 'easeInOut',
              delay: i * 0.04,
            }}
            className="w-1 bg-indigo-500 dark:bg-indigo-400 rounded-full"
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDiscard}
          className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          title="Cancel Voice Message"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleFinishAndSend}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-transform active:scale-95 shadow-sm"
          title="Send Voice Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
