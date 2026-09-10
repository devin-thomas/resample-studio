import { useState, useEffect, useCallback, useRef } from 'react';
import { Track, KnobSettings, PlaybackState } from './types/audio';
import { audioEngine } from './audio/engine';
import { centsToPlaybackRate, centsToSpeedPercent } from './audio/resampleMath';
import { createDemoTrack } from './audio/demoAudio';
import { AudioVisualizer } from './components/AudioVisualizer';
import { KnobControlPanel } from './components/KnobControlPanel';
import { Playlist } from './components/Playlist';
import { TransportBar } from './components/TransportBar';
import { ExportModal } from './components/ExportModal';
import {
  Disc3,
  Sparkles,
  Download,
  Music,
  Sliders,
  PlaySquare,
  UploadCloud,
} from 'lucide-react';

const DEFAULT_KNOB_SETTINGS: KnobSettings = {
  pitchCents: 0,
  speedPercent: 100.0,
  centsStep: 10,
  linkMode: 'linked',
  capMode: 'basic',
  basicCap: 1200,
  advancedMinCents: -1200,
  advancedMaxCents: 1200,
  advancedMinSpeed: 25.0,
  advancedMaxSpeed: 400.0,
};

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [knobSettings, setKnobSettings] = useState<KnobSettings>(DEFAULT_KNOB_SETTINGS);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    activeTrackId: null,
    volume: 1.0,
    isMuted: false,
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'controls' | 'playlist'>('controls');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // No demo auto-load — musicians should personalize with their own audio (ADR 5)

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;

  // Active track change: sync audio engine & knobs
  useEffect(() => {
    if (activeTrack) {
      audioEngine.loadTrack(activeTrack, playback.isPlaying);

      // If track is locked, restore track's custom settings
      if (activeTrack.isLocked) {
        const speed = centsToSpeedPercent(activeTrack.pitchCents);
        setKnobSettings((prev) => ({
          ...prev,
          pitchCents: activeTrack.pitchCents,
          speedPercent: speed,
        }));
        audioEngine.setPlaybackRateFromCents(activeTrack.pitchCents);
      } else {
        // Apply current knobs to this unlocked track
        audioEngine.setPlaybackRateFromCents(knobSettings.pitchCents);
      }
    }
  }, [activeTrackId]);

  // Handle Audio Engine Event subscriptions
  useEffect(() => {
    const unsubTime = audioEngine.onTimeUpdate((cur, dur) => {
      setPlayback((prev) => ({ ...prev, currentTime: cur, duration: dur }));
    });

    const unsubPlayState = audioEngine.onPlayStateChange((playing) => {
      setPlayback((prev) => ({ ...prev, isPlaying: playing }));
    });

    const unsubEnded = audioEngine.onTrackEnded(() => {
      handleNextTrack();
    });

    return () => {
      unsubTime();
      unsubPlayState();
      unsubEnded();
    };
  }, [tracks, activeTrackId]);

  // Knob change handler
  const handleKnobChange = (updated: KnobSettings) => {
    setKnobSettings(updated);

    // Update real-time audio playback rate
    if (updated.linkMode === 'linked') {
      audioEngine.setPlaybackRateFromCents(updated.pitchCents);
    } else if (updated.linkMode === 'opposite') {
      const rate = centsToPlaybackRate(-updated.pitchCents);
      audioEngine.setPlaybackRate(rate);
    } else {
      // Independent
      audioEngine.setPlaybackRate(updated.speedPercent / 100);
    }

    // If active track is locked, save knobs to that track
    if (activeTrackId) {
      setTracks((prev) =>
        prev.map((t) => {
          if (t.id === activeTrackId && t.isLocked) {
            return {
              ...t,
              pitchCents: updated.pitchCents,
              speedPercent: updated.speedPercent,
            };
          }
          return t;
        })
      );
    }
  };

  // Knob reset
  const handleKnobReset = () => {
    const resetSettings: KnobSettings = {
      ...knobSettings,
      pitchCents: 0,
      speedPercent: 100.0,
    };
    handleKnobChange(resetSettings);
  };

  // Add files
  const handleAddFiles = async (fileList: FileList | File[]) => {
    const newTracks: Track[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const objectUrl = URL.createObjectURL(file);

      // Probe duration with temporary Audio element
      const duration = await new Promise<number>((resolve) => {
        const tempAudio = new Audio(objectUrl);
        tempAudio.addEventListener('loadedmetadata', () => {
          resolve(tempAudio.duration || 0);
        });
        tempAudio.addEventListener('error', () => {
          resolve(0);
        });
      });

      newTracks.push({
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        duration,
        file,
        objectUrl,
        pitchCents: knobSettings.pitchCents,
        speedPercent: knobSettings.speedPercent,
        isLocked: false,
        selectedForExport: true,
      });
    }

    setTracks((prev) => [...prev, ...newTracks]);
    if (!activeTrackId && newTracks.length > 0) {
      setActiveTrackId(newTracks[0].id);
    }
  };

  // Remove track
  const handleRemoveTrack = (trackId: string) => {
    const remaining = tracks.filter((t) => t.id !== trackId);
    setTracks(remaining);
    if (activeTrackId === trackId) {
      if (remaining.length > 0) {
        setActiveTrackId(remaining[0].id);
      } else {
        setActiveTrackId(null);
        audioEngine.pause();
      }
    }
  };

  // Toggle track lock
  const handleToggleTrackLock = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const nextLocked = !t.isLocked;
          return {
            ...t,
            isLocked: nextLocked,
            // When locking, seal current active pitch & speed to this track
            pitchCents: nextLocked ? knobSettings.pitchCents : t.pitchCents,
            speedPercent: nextLocked ? knobSettings.speedPercent : t.speedPercent,
          };
        }
        return t;
      })
    );
  };

  // Toggle track export selection
  const handleToggleTrackExportSelection = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, selectedForExport: !t.selectedForExport } : t))
    );
  };

  // Toggle select all export
  const handleToggleSelectAllExport = (selected: boolean) => {
    setTracks((prev) => prev.map((t) => ({ ...t, selectedForExport: selected })));
  };

  // Set explicit subset for export
  const handleSetSelectedTracks = (trackIds: string[]) => {
    const idSet = new Set(trackIds);
    setTracks((prev) => prev.map((t) => ({ ...t, selectedForExport: idSet.has(t.id) })));
  };

  // Reorder track
  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    const newTracks = [...tracks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTracks.length) return;
    const [moved] = newTracks.splice(index, 1);
    newTracks.splice(targetIndex, 0, moved);
    setTracks(newTracks);
  };

  // Previous Track
  const handlePrevTrack = () => {
    if (tracks.length === 0) return;
    const curIdx = tracks.findIndex((t) => t.id === activeTrackId);
    const prevIdx = curIdx > 0 ? curIdx - 1 : tracks.length - 1;
    setActiveTrackId(tracks[prevIdx].id);
  };

  // Next Track
  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const curIdx = tracks.findIndex((t) => t.id === activeTrackId);
    const nextIdx = curIdx < tracks.length - 1 ? curIdx + 1 : 0;
    setActiveTrackId(tracks[nextIdx].id);
  }, [tracks, activeTrackId]);

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (playback.isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  // Seek
  const handleSeek = (time: number) => {
    audioEngine.seek(time);
  };

  // Volume & Mute
  const handleVolumeChange = (vol: number) => {
    setPlayback((prev) => ({ ...prev, volume: vol, isMuted: false }));
    audioEngine.setVolume(vol);
  };

  const handleToggleMute = () => {
    const nextMuted = !playback.isMuted;
    setPlayback((prev) => ({ ...prev, isMuted: nextMuted }));
    audioEngine.setVolume(nextMuted ? 0 : playback.volume);
  };

  return (
    <div className="min-h-screen bg-studio-950 text-slate-100 flex flex-col selection:bg-cyan-500/20">
      {/* Full-Bleed Background Visualizer (ADR 6) */}
      <AudioVisualizer />

      {/* Hidden File Input for Empty State Dropzone */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.aac,.m4a"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleAddFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Studio Header */}
      <header className="border-b border-white/10 bg-studio-900/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Disc3
              className={`w-5 h-5 text-black ${playback.isPlaying ? 'animate-spin' : ''}`}
              style={{ animationDuration: '4s' }}
            />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              RESAMPLE STUDIO
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">PRO VARISPEED & MIX LAB</p>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Demo button */}
          <button
            type="button"
            onClick={() => {
              const demo = createDemoTrack();
              setTracks((prev) => [...prev, demo]);
              setActiveTrackId(demo.id);
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-700 border border-white/5 text-xs text-slate-300 font-mono transition-all cursor-pointer"
            title="Load demo electronic groove"
          >
            <PlaySquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Load Demo</span>
          </button>

          {/* 120Hz Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-studio-800/80 border border-white/5 text-xs text-cyan-400 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>120Hz ENGINE</span>
          </div>

          {/* Export Mix Trigger */}
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="py-1.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Mix</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Tab Switcher (Visible on mobile only, hidden when empty) */}
      {tracks.length > 0 && (
        <div className="lg:hidden flex border-b border-white/10 bg-studio-900/60 backdrop-blur-md px-4 py-2 gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setMobileTab('controls')}
            className={`flex-1 py-2 rounded-xl text-xs font-mono flex items-center justify-center gap-2 transition-all ${
              mobileTab === 'controls'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 bg-studio-900/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Deck & Knobs</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('playlist')}
            className={`flex-1 py-2 rounded-xl text-xs font-mono flex items-center justify-center gap-2 transition-all ${
              mobileTab === 'playlist'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 bg-studio-900/40'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Playlist ({tracks.length})</span>
          </button>
        </div>
      )}

      {/* Main Studio Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 relative z-10 mb-24">
        {tracks.length === 0 ? (
          /* ============================================ */
          /* EMPTY STATE: Upload-First (ADR 5, T-09)     */
          /* ============================================ */
          <div className="flex flex-col items-center justify-center gap-6 py-8 sm:py-12">
            {/* Primary Upload Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleAddFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`group cursor-pointer w-full max-w-lg rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-200 touch-manipulation backdrop-blur-xl ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
                  : 'border-white/15 bg-studio-900/60 hover:border-white/30 hover:bg-studio-900/80'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-200 group-hover:text-white">
                    Choose your audio files
                  </p>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Tap to browse or drop{' '}
                    <span className="text-slate-200 font-semibold">.mp3</span>,{' '}
                    <span className="text-slate-200 font-semibold">.wav</span>,{' '}
                    <span className="text-slate-200 font-semibold">.aac</span>, or{' '}
                    <span className="text-slate-200 font-semibold">.m4a</span>
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-[11px] text-slate-400 font-mono">
                  <span>Local-first • Processed in browser</span>
                </div>
              </div>
            </div>

            {/* Idle Guidance Card */}
            <div className="w-full max-w-lg rounded-2xl bg-studio-900/40 backdrop-blur-md border border-white/5 p-5 text-center">
              <p className="text-xs font-medium text-slate-300">
                Mathematical Varispeed Resampler
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                Tape-style speed & pitch locking using{' '}
                <code className="text-cyan-300 font-mono text-[10px]">
                  ratio = 2 ** (cents / 1200)
                </code>
                . Audition, manipulate, and export high-bitrate MP3s directly on iPhone or desktop.
              </p>
            </div>
          </div>
        ) : (
          /* ============================================ */
          /* ACTIVE STATE: Controls Above the Fold (T-10) */
          /* ============================================ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Left Column: Upload Card + Knobs */}
            <div
              className={`lg:col-span-7 xl:col-span-8 flex flex-col gap-4 ${
                mobileTab === 'playlist' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Compact Loaded File Card */}
              <div className="studio-glass rounded-2xl p-4 backdrop-blur-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {activeTrack?.name || 'Select a track'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {tracks.length} track{tracks.length !== 1 ? 's' : ''} loaded
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-xl bg-studio-800 hover:bg-studio-700 text-slate-300 hover:text-white border border-white/10 transition active:scale-95 touch-manipulation cursor-pointer"
                >
                  Add More
                </button>
              </div>

              {/* Master Tactile Dual Knobs Panel — immediately visible */}
              <KnobControlPanel
                settings={knobSettings}
                onChange={handleKnobChange}
                onReset={handleKnobReset}
              />
            </div>

            {/* Right Column: Playlist Queue & Quick Export */}
            <div
              className={`lg:col-span-5 xl:col-span-4 flex flex-col gap-4 ${
                mobileTab === 'controls' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Multi-Track Playlist */}
              <Playlist
                tracks={tracks}
                activeTrackId={activeTrackId}
                isPlaying={playback.isPlaying}
                onSelectTrack={(id) => setActiveTrackId(id)}
                onTogglePlay={handleTogglePlay}
                onAddFiles={handleAddFiles}
                onRemoveTrack={handleRemoveTrack}
                onToggleTrackLock={handleToggleTrackLock}
                onToggleTrackExportSelection={handleToggleTrackExportSelection}
                onToggleSelectAllExport={handleToggleSelectAllExport}
                onMoveTrack={handleMoveTrack}
              />

              {/* Concatenation Mix Quick Launcher */}
              <div className="studio-glass rounded-2xl p-5 backdrop-blur-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    SELECTIVE MIX EXPORT
                  </span>
                  <span className="text-xs font-mono text-cyan-400">≤ 320 KBPS MP3</span>
                </div>
                <p className="text-xs text-slate-400">
                  Combine any track subset into a seamless varispeed mix export with per-track or global pitch.
                </p>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Configure & Export Mix</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom Floating Transport Bar with iOS Safe Area */}
      {tracks.length > 0 && (
        <footer className="fixed bottom-0 inset-x-0 z-40 bg-studio-950/90 backdrop-blur-lg border-t border-white/10 px-4 py-3 pb-safe">
          <div className="max-w-7xl mx-auto">
            <TransportBar
              currentTrack={activeTrack}
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              duration={playback.duration}
              volume={playback.volume}
              isMuted={playback.isMuted}
              onTogglePlay={handleTogglePlay}
              onPrevTrack={handlePrevTrack}
              onNextTrack={handleNextTrack}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
            />
          </div>
        </footer>
      )}

      {/* Selective Mix Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        tracks={tracks}
        masterPitchCents={knobSettings.pitchCents}
        onClose={() => setIsExportModalOpen(false)}
        onToggleTrackExport={handleToggleTrackExportSelection}
        onSetSelectedTracks={handleSetSelectedTracks}
      />
    </div>
  );
}
