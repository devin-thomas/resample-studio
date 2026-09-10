import React, { useState } from 'react';
import { Track } from '../types/audio';
import { concatenateAndExportMp3 } from '../audio/concatenator';
import { formatTime } from '../audio/resampleMath';
import {
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  tracks: Track[];
  masterPitchCents: number;
  onClose: () => void;
  onToggleTrackExport: (trackId: string) => void;
  onSetSelectedTracks: (trackIds: string[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  tracks,
  masterPitchCents,
  onClose,
  onToggleTrackExport,
  onSetSelectedTracks,
}) => {
  const [useTrackSettings, setUseTrackSettings] = useState(true);
  const [kbps, setKbps] = useState(320);
  const [filename, setFilename] = useState('resample-studio-mix.mp3');
  const [quickRangeInput, setQuickRangeInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedTracks = tracks.filter((t) => t.selectedForExport);

  // Quick range parser: e.g. "1-3", "1, 3, 5", "1-2, 4"
  const handleApplyQuickRange = () => {
    if (!quickRangeInput.trim()) return;
    const parts = quickRangeInput.split(/[\s,]+/);
    const selectedIndices = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const low = Math.min(start, end);
          const high = Math.max(start, end);
          for (let i = low; i <= high; i++) {
            if (i >= 1 && i <= tracks.length) {
              selectedIndices.add(i - 1);
            }
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= tracks.length) {
          selectedIndices.add(num - 1);
        }
      }
    }

    const newSelectedIds = Array.from(selectedIndices).map((idx) => tracks[idx].id);
    onSetSelectedTracks(newSelectedIds);
    setQuickRangeInput('');
  };

  const handleStartExport = async () => {
    if (selectedTracks.length === 0) {
      setError('Please select at least one track to export.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setDownloadUrl(null);
    setProgressPercent(0);

    try {
      const blob = await concatenateAndExportMp3({
        tracks: selectedTracks,
        useTrackSettings,
        masterPitchCents,
        kbps,
        onStatusUpdate: (text, pct) => {
          setStatusText(text);
          setProgressPercent(pct);
        },
      });

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Trigger auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Estimate total mix duration
  const totalDuration = selectedTracks.reduce((acc, t) => {
    const rate = Math.pow(
      2,
      (useTrackSettings && t.isLocked ? t.pitchCents : masterPitchCents) / 1200
    );
    return acc + t.duration / rate;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="studio-glass w-full max-w-2xl rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                SELECTIVE MULTI-TRACK MIX EXPORT
              </h2>
              <p className="text-xs font-mono text-slate-300">
                High-Fidelity ≤ 320kbps MP3 Concatenation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition-all cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Selection Section */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-white font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-white" />
              CHOOSE TRACK SUBSET ({selectedTracks.length} / {tracks.length} SELECTED):
            </span>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => onSetSelectedTracks(tracks.map((t) => t.id))}
                className="px-2 py-0.5 rounded bg-studio-800 hover:bg-studio-700 text-white font-semibold border border-white/10 cursor-pointer"
              >
                All
              </button>
              {tracks.length >= 1 && (
                <button
                  type="button"
                  onClick={() => onSetSelectedTracks([tracks[0].id])}
                  className="px-2 py-0.5 rounded bg-studio-800 hover:bg-studio-700 text-white font-semibold border border-white/10 cursor-pointer"
                >
                  Track 1
                </button>
              )}
              {tracks.length >= 3 && (
                <button
                  type="button"
                  onClick={() =>
                    onSetSelectedTracks([tracks[0].id, tracks[1].id, tracks[2].id])
                  }
                  className="px-2 py-0.5 rounded bg-studio-800 hover:bg-studio-700 text-white font-semibold border border-white/10 cursor-pointer"
                >
                  1–3
                </button>
              )}
              <button
                type="button"
                onClick={() => onSetSelectedTracks([])}
                className="px-2 py-0.5 rounded bg-studio-800 hover:bg-studio-700 text-slate-300 border border-white/5 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Quick subset text input (e.g. 1-3, 1,3,5) */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 1-3 or 1, 3, 5"
              value={quickRangeInput}
              onChange={(e) => setQuickRangeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyQuickRange()}
              className="flex-1 px-3 py-1.5 bg-studio-900 border border-white/15 rounded-lg text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-white"
            />
            <button
              type="button"
              onClick={handleApplyQuickRange}
              className="px-3 py-1.5 bg-white text-black font-bold rounded-lg text-xs font-mono cursor-pointer hover:bg-slate-200"
            >
              Select Subset
            </button>
          </div>

          {/* Scrollable Track Checkbox List */}
          <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-1.5 bg-studio-900/50 p-2.5 rounded-xl border border-white/10">
            {tracks.length === 0 ? (
              <div className="text-center py-4 text-xs font-mono text-slate-400">
                No tracks in playlist
              </div>
            ) : (
              tracks.map((track, idx) => {
                const isSelected = track.selectedForExport;
                return (
                  <div
                    key={track.id}
                    onClick={() => onToggleTrackExport(track.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/10 border border-white/20 text-white'
                        : 'bg-studio-950/40 border border-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-white flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-mono font-bold text-white">
                        #{idx + 1}
                      </span>
                      <span className="text-xs truncate font-medium">{track.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300 flex-shrink-0">
                      <span>{formatTime(track.duration)}</span>
                      <span>•</span>
                      <span className={track.pitchCents !== 0 ? 'text-white font-bold' : ''}>
                        {track.pitchCents > 0 ? `+${track.pitchCents}` : track.pitchCents}¢
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resample Settings Mode */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span className="text-xs font-mono text-white font-bold">
            RESAMPLE PARAMETER SOURCE:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUseTrackSettings(true)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                useTrackSettings
                  ? 'bg-white/10 border-white/30 text-white shadow-sm'
                  : 'bg-studio-900/40 border-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold font-mono">Use Per-Track Locked Knobs</div>
              <div className="text-[10px] text-slate-300 mt-1 font-medium">
                Each track renders with its individual locked pitch & speed
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUseTrackSettings(false)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                !useTrackSettings
                  ? 'bg-white/10 border-white/30 text-white shadow-sm'
                  : 'bg-studio-900/40 border-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold font-mono">Apply Master Global Knobs</div>
              <div className="text-[10px] text-slate-300 mt-1 font-medium">
                All selected tracks apply master pitch ({masterPitchCents}¢)
              </div>
            </button>
          </div>
        </div>

        {/* Output Bitrate & File Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-white font-semibold">BITRATE QUALITY:</label>
            <select
              value={kbps}
              onChange={(e) => setKbps(Number(e.target.value))}
              className="bg-studio-900 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-white"
            >
              <option value={320}>320 kbps (Maximum Studio Fidelity)</option>
              <option value={256}>256 kbps (High Quality)</option>
              <option value={192}>192 kbps (Standard Quality)</option>
              <option value={128}>128 kbps (Compact)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-white font-semibold">OUTPUT FILENAME:</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="bg-studio-900 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
            />
          </div>
        </div>

        {/* Summary Info */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-200 bg-studio-900/80 px-3 py-2 rounded-lg border border-white/10">
          <span>Selected: {selectedTracks.length} tracks</span>
          <span>Estimated Total Mix Length: {formatTime(totalDuration)}</span>
        </div>

        {/* Progress or Error Display */}
        {isExporting && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/10 border border-white/20">
            <div className="flex items-center justify-between text-xs font-mono text-white font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-white" />
                {statusText}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-studio-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {downloadUrl && !isExporting && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Export Complete! Download ready.</span>
            </div>
            <a
              href={downloadUrl}
              download={filename}
              className="px-3 py-1 bg-white text-black font-bold rounded-lg hover:bg-slate-200 transition-all"
            >
              Re-download
            </a>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-mono text-slate-300 hover:text-white cursor-pointer disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || selectedTracks.length === 0}
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Rendering Mix...' : 'Export Concatenated Mix'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
