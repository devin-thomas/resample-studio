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
    <div className="studio-glass rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5">
      {/* Current Track Label */}
      <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-studio-900 border border-white/10 flex items-center justify-center flex-shrink-0">
          <div
            className={`w-3 h-3 rounded-full ${
              isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
            }`}
          />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-100 truncate">
            {currentTrack ? currentTrack.name : 'No track selected'}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {currentTrack
              ? `${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`
              : '--:--'}
          </div>
        </div>
      </div>

      {/* Central Transport Controls & Timeline */}
      <div className="flex flex-col items-center gap-2 w-full md:w-2/4">
        <div className="flex items-center gap-3">
          {/* Previous Track */}
          <button
            type="button"
            onClick={onPrevTrack}
            className="p-2 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-cyan-400 text-black shadow-cyan-400/30'
                : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-black hover:scale-105 shadow-cyan-500/20 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 ml-0.5 fill-current" />
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNextTrack}
            className="p-2 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3 w-full max-w-md">
          <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
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
              className="w-full h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 group-hover:h-2 transition-all"
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 w-8">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Volume & Audio Output Control */}
      <div className="flex items-center justify-end gap-2 w-full md:w-1/4">
        <button
          type="button"
          onClick={onToggleMute}
          className="p-2 text-slate-400 hover:text-white cursor-pointer"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-cyan-400" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-20 h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
      </div>
    </div>
  );
};
