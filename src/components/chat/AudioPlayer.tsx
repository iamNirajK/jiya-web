import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  durationSec?: number;
  isSelf: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  durationSec = 0,
  isSelf,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSec || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[190px] max-w-[240px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-sm ${
          isSelf
            ? 'bg-white text-indigo-600 hover:bg-slate-100'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        {/* Waveform representation */}
        <div className="flex items-center gap-0.5 h-4 w-full">
          {[20, 45, 80, 50, 95, 30, 70, 40, 85, 60, 30, 90, 50, 75, 40, 20].map(
            (heightPercent, i) => {
              const barProgress = (i / 16) * 100;
              const isPast = barProgress <= progressPercent;

              return (
                <div
                  key={i}
                  style={{ height: `${heightPercent}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    isPast
                      ? isSelf
                        ? 'bg-white'
                        : 'bg-indigo-600 dark:bg-indigo-400'
                      : isSelf
                      ? 'bg-white/40'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              );
            }
          )}
        </div>

        <div className="flex justify-between text-[10px] opacity-80 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};
