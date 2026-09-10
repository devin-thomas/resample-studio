import React, { useRef } from 'react';
import { Track } from '../types/audio';
import { formatTime, formatFileSize } from '../audio/resampleMath';
import {
  Music,
  Play,
  Pause,
  Lock,
  Unlock,
  Trash2,
  Upload,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface PlaylistProps {
  tracks: Track[];
  activeTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onTogglePlay: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveTrack: (trackId: string) => void;
  onToggleTrackLock: (trackId: string) => void;
  onToggleTrackExportSelection: (trackId: string) => void;
  onToggleSelectAllExport: (selected: boolean) => void;
  onMoveTrack: (index: number, direction: 'up' | 'down') => void;
}

export const Playlist: React.FC<PlaylistProps> = ({
  tracks,
  activeTrackId,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onAddFiles,
  onRemoveTrack,
  onToggleTrackLock,
  onToggleTrackExportSelection,
  onToggleSelectAllExport,
  onMoveTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const allSelectedForExport =
    tracks.length > 0 && tracks.every((t) => t.selectedForExport);

  return (
    <div
      className="studio-glass rounded-2xl p-5 flex flex-col h-full gap-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.aac,.m4a"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            PLAYLIST QUEUE ({tracks.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-700 text-cyan-400 border border-white/5 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Add Audio</span>
        </button>
      </div>

      {/* Select All Export Mix bar if tracks exist */}
      {tracks.length > 0 && (
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <button
            type="button"
            onClick={() => onToggleSelectAllExport(!allSelectedForExport)}
            className="flex items-center gap-1.5 hover:text-white transition-all cursor-pointer"
          >
            {allSelectedForExport ? (
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Select All For Mix</span>
          </button>
          <span className="text-[11px] text-slate-500">
            {tracks.filter((t) => t.selectedForExport).length} selected
          </span>
        </div>
      )}

      {/* Tracks List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 flex flex-col gap-2">
        {tracks.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-48 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer"
          >
            <Upload className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">Drop audio files here</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Supports MP3, WAV, AAC, M4A
            </p>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isActive = track.id === activeTrackId;
            const format = track.name.split('.').pop()?.toUpperCase() || 'AUDIO';

            return (
              <div
                key={track.id}
                className={`group flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-studio-800/90 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-studio-900/40 border-white/5 hover:border-white/15'
                }`}
              >
                {/* Export Checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleTrackExportSelection(track.id)}
                  className="text-slate-500 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Include in selective mix export"
                >
                  {track.selectedForExport ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                {/* Play / Status icon */}
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      onTogglePlay();
                    } else {
                      onSelectTrack(track.id);
                    }
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    isActive && isPlaying
                      ? 'bg-cyan-500 text-black'
                      : 'bg-studio-800 text-slate-300 hover:bg-studio-700'
                  }`}
                >
                  {isActive && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                  )}
                </button>

                {/* Track Info */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectTrack(track.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-cyan-300 font-semibold' : 'text-slate-200'
                      }`}
                      title={track.name}
                    >
                      {track.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-studio-950 text-slate-400 font-mono">
                      {format}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>{formatTime(track.duration)}</span>
                    <span>•</span>
                    <span>{formatFileSize(track.size)}</span>
                    <span>•</span>
                    <span
                      className={
                        track.pitchCents !== 0 ? 'text-cyan-400' : 'text-slate-500'
                      }
                    >
                      {track.pitchCents > 0 ? `+${track.pitchCents}` : track.pitchCents}¢
                    </span>
                    <span>•</span>
                    <span
                      className={
                        track.speedPercent !== 100.0 ? 'text-amber-400' : 'text-slate-500'
                      }
                    >
                      {track.speedPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Per-Track Lock Button */}
                <button
                  type="button"
                  onClick={() => onToggleTrackLock(track.id)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    track.isLocked
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                      : 'bg-studio-950/60 text-slate-500 border-white/5 hover:text-slate-300'
                  }`}
                  title={
                    track.isLocked
                      ? 'Track settings locked: Knobs recall this track’s values'
                      : 'Track unlocked: Follows master controls'
                  }
                >
                  {track.isLocked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Reorder Up/Down */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveTrack(idx, 'up')}
                    className="text-slate-500 hover:text-slate-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === tracks.length - 1}
                    onClick={() => onMoveTrack(idx, 'down')}
                    className="text-slate-500 hover:text-slate-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => onRemoveTrack(track.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                  title="Remove track"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
