import React from 'react';
import { Track } from '../types/audio';
import { formatTime } from '../audio/resampleMath';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface TransportBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
}) => {
  const effectiveDuration = duration || currentTrack?.duration || 0;

  return (
    <div className="studio-glass rounded-2xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 border-2 border-zinc-500/70 shadow-2xl ring-1 ring-zinc-400/20">
      {/* Top Row: Track Metadata + Main Controls + Volume (on desktop) */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Track Label */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:w-1/3">
          <div className="w-8 h-8 rounded-xl bg-studio-900 border border-white/10 flex items-center justify-center flex-shrink-0">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold text-white truncate" title={currentTrack?.name}>
              {currentTrack ? currentTrack.name : 'No track loaded'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-300">
              {currentTrack
                ? `${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`
                : '--:--'}
            </div>
          </div>
        </div>

        {/* Central Transport Controls */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* Previous / Restart Track */}
          <button
            type="button"
            onClick={onPrevTrack}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Restart / Previous Track"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-white text-black shadow-white/20'
                : 'bg-white text-black hover:bg-slate-200 hover:scale-105 shadow-white/20 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-current" />
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNextTrack}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Volume & Audio Output Control (Desktop only, mobile uses hardware buttons) */}
        <div className="hidden md:flex items-center justify-end gap-2 w-1/3">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-20 h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>
      </div>

      {/* Timeline Scrubber Row */}
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        <span className="text-[10px] font-mono text-slate-300 w-8 text-right flex-shrink-0">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 flex items-center group cursor-pointer">
          <input
            type="range"
            min="0"
            max={effectiveDuration || 1}
            step="0.1"
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 sm:h-2 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-white hover:h-2.5 transition-all"
          />
        </div>
        <span className="text-[10px] font-mono text-slate-300 w-8 flex-shrink-0">
          {formatTime(effectiveDuration)}
        </span>
      </div>
    </div>
  );
};
