import { useState, useEffect, useCallback, useRef } from 'react';
import { Track, KnobSettings, PlaybackState, RepeatMode } from './types/audio';
import { audioEngine } from './audio/engine';
import { centsToSpeedPercent } from './audio/resampleMath';
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
  UploadCloud,
  Moon,
  Minimize2,
} from 'lucide-react';

const DEFAULT_KNOB_SETTINGS: KnobSettings = {
  pitchCents: 0,
  speedPercent: 100.0,
  centsStep: 3,
  linkMode: 'pitch',
  capMode: 'basic',
  basicCap: 400, // Default pitch bounds to +/- 400 cents (outer bounds 1200 still possible in advanced)
  advancedMinCents: -1200,
  advancedMaxCents: 1200,
  advancedMinSpeed: 25.0,
  advancedMaxSpeed: 400.0,
};

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [knobSettings, setKnobSettings] = useState<KnobSettings>(DEFAULT_KNOB_SETTINGS);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [isShuffle, setIsShuffle] = useState(false);
  const [isChillMode, setIsChillMode] = useState(false);
  const autoPlayNextRef = useRef(false);

  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    activeTrackId: null,
    volume: 1.0,
    isMuted: false,
    repeatMode: 'all',
    isShuffle: false,
    isChillMode: false,
  });
  const [mobileTab, setMobileTab] = useState<'controls' | 'playlist'>('controls');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive active track object
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;

  // Active track change: sync audio engine & knobs
  useEffect(() => {
    if (activeTrack) {
      const shouldPlay = autoPlayNextRef.current || playback.isPlaying;
      autoPlayNextRef.current = false;
      audioEngine.loadTrack(activeTrack, shouldPlay);

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
        if (knobSettings.linkMode === 'pitch') {
          audioEngine.setPlaybackRateFromCents(knobSettings.pitchCents);
        } else {
          audioEngine.setPlaybackRate(knobSettings.speedPercent / 100);
        }
      }
    }
  }, [activeTrackId]);

  // Knob change handler
  const handleKnobChange = (updated: KnobSettings) => {
    setKnobSettings(updated);

    // Update real-time audio playback rate
    if (updated.linkMode === 'pitch') {
      audioEngine.setPlaybackRateFromCents(updated.pitchCents);
    } else {
      // 'speed' or 'unlinked'
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
      centsStep: 3,
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

  // Toggle repeat mode: all -> one -> none -> all
  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      const next: RepeatMode = prev === 'all' ? 'one' : prev === 'one' ? 'none' : 'all';
      return next;
    });
  };

  // Toggle shuffle mode
  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  // Toggle chill mode
  const handleToggleChillMode = () => {
    setIsChillMode((prev) => !prev);
  };

  // Esc key listener to exit chill mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChillMode) {
        setIsChillMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChillMode]);

  // Previous Track
  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;

    // If played more than 3 seconds, restart current track
    if (playback.currentTime > 3) {
      audioEngine.seek(0);
      return;
    }

    const curIdx = tracks.findIndex((t) => t.id === activeTrackId);
    if (isShuffle && tracks.length > 1) {
      let randomIdx = Math.floor(Math.random() * (tracks.length - 1));
      if (randomIdx >= curIdx) randomIdx++;
      setActiveTrackId(tracks[randomIdx].id);
      return;
    }

    const prevIdx = curIdx > 0 ? curIdx - 1 : tracks.length - 1;
    setActiveTrackId(tracks[prevIdx].id);
  }, [tracks, activeTrackId, playback.currentTime, isShuffle]);

  // Next Track (Manual)
  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const curIdx = tracks.findIndex((t) => t.id === activeTrackId);

    if (isShuffle && tracks.length > 1) {
      let randomIdx = Math.floor(Math.random() * (tracks.length - 1));
      if (randomIdx >= curIdx) randomIdx++;
      setActiveTrackId(tracks[randomIdx].id);
      return;
    }

    const nextIdx = curIdx < tracks.length - 1 ? curIdx + 1 : 0;
    setActiveTrackId(tracks[nextIdx].id);
  }, [tracks, activeTrackId, isShuffle]);

  // Track Ended (Auto-advance based on repeatMode and isShuffle)
  const handleTrackEnded = useCallback(() => {
    if (tracks.length === 0) return;

    if (repeatMode === 'one') {
      // Repeat One: Loop the single track continuously
      audioEngine.seek(0);
      audioEngine.play();
      return;
    }

    const curIdx = tracks.findIndex((t) => t.id === activeTrackId);

    if (isShuffle) {
      if (tracks.length === 1) {
        if (repeatMode === 'all') {
          audioEngine.seek(0);
          audioEngine.play();
        } else {
          audioEngine.pause();
          audioEngine.seek(0);
        }
        return;
      }
      autoPlayNextRef.current = true;
      let randomIdx = Math.floor(Math.random() * (tracks.length - 1));
      if (randomIdx >= curIdx) randomIdx++;
      setActiveTrackId(tracks[randomIdx].id);
      return;
    }

    // Sequential:
    if (curIdx < tracks.length - 1) {
      autoPlayNextRef.current = true;
      setActiveTrackId(tracks[curIdx + 1].id);
    } else {
      // End of playlist reached
      if (repeatMode === 'all') {
        // Repeat All (Default): Loop back to track 0 and auto-play
        autoPlayNextRef.current = true;
        setActiveTrackId(tracks[0].id);
      } else {
        // Repeat None: Stop playback at end of playlist
        audioEngine.pause();
        audioEngine.seek(0);
      }
    }
  }, [tracks, activeTrackId, repeatMode, isShuffle]);

  // Ref to latest handleTrackEnded
  const handleTrackEndedRef = useRef(handleTrackEnded);
  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
  }, [handleTrackEnded]);

  // Audio Engine event subscriptions
  useEffect(() => {
    const unsubTime = audioEngine.onTimeUpdate((cur, dur) => {
      setPlayback((prev) => ({ ...prev, currentTime: cur, duration: dur }));
    });

    const unsubPlayState = audioEngine.onPlayStateChange((playing) => {
      setPlayback((prev) => ({ ...prev, isPlaying: playing }));
    });

    const unsubEnded = audioEngine.onTrackEnded(() => {
      handleTrackEndedRef.current();
    });

    return () => {
      unsubTime();
      unsubPlayState();
      unsubEnded();
    };
  }, []);

  // Sync MediaSession next/prev action handlers
  useEffect(() => {
    audioEngine.setMediaSessionActionHandlers({
      onNext: handleNextTrack,
      onPrev: handlePrevTrack,
    });
  }, [handleNextTrack, handlePrevTrack]);

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
    <div className="min-h-screen bg-studio-950 text-slate-100 flex flex-col selection:bg-white/20">
      {/* Full-Bleed Background Visualizer (ADR 6) */}
      <AudioVisualizer hasFooter={tracks.length > 0 || isChillMode} />

      {/* Floating Exit Chill Mode Button (Visible only in Chill Mode) */}
      {isChillMode && (
        <div className="fixed top-5 right-5 z-50">
          <button
            type="button"
            onClick={() => setIsChillMode(false)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-studio-950/80 hover:bg-studio-900 border border-white/20 text-xs font-mono text-white font-bold backdrop-blur-md shadow-2xl transition-all cursor-pointer hover:scale-105"
            title="Exit Chill Mode (or press Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5 text-white" />
            <span>Exit Chill Mode</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-white/15 px-1.5 py-0.5 rounded text-slate-200 font-mono font-normal ml-0.5">
              ESC
            </kbd>
          </button>
        </div>
      )}

      {/* When NOT in Chill Mode: Render Header, Tabs, and Main Studio Area */}
      {!isChillMode && (
        <>
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
          <header className="border-b border-white/10 bg-studio-900/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Disc3
                  className={`w-5 h-5 text-black ${playback.isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '4s' }}
                />
              </div>
              <div>
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  RESAMPLE STUDIO
                </h1>
                <p className="text-[10px] text-slate-300 font-mono font-semibold tracking-wider">
                  PRO VARISPEED & MIX LAB
                </p>
              </div>
            </div>

            {/* Action Pills */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Chill Mode Trigger in Header */}
              {tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsChillMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-700 border border-white/10 text-xs text-white font-mono font-semibold transition-all cursor-pointer shadow-sm"
                  title="Enter Chill Mode (full visualizer with music player)"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="hidden sm:inline">Chill Mode</span>
                </button>
              )}

              {/* 120Hz Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-studio-800/80 border border-white/10 text-xs text-white font-mono font-medium">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>120Hz ENGINE</span>
              </div>

          {/* Export Mix Trigger (Green) */}
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="py-1.5 px-3 sm:px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Mix</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Tab Switcher (Visible on mobile only, hidden when empty) */}
      {tracks.length > 0 && (
        <div className="lg:hidden flex border-b border-white/10 bg-studio-900/80 backdrop-blur-md px-4 py-2 gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setMobileTab('controls')}
            className={`flex-1 py-2 rounded-xl text-xs font-mono flex items-center justify-center gap-2 transition-all ${
              mobileTab === 'controls'
                ? 'bg-white text-black font-bold shadow'
                : 'text-slate-300 bg-studio-900/60 border border-white/5'
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
                ? 'bg-white text-black font-bold shadow'
                : 'text-slate-300 bg-studio-900/60 border border-white/5'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Playlist ({tracks.length})</span>
          </button>
        </div>
      )}

      {/* Main Studio Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 relative z-10 mb-32 sm:mb-28">
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
              className={`group cursor-pointer w-full max-w-lg rounded-2xl border-2 border-dashed p-8 sm:p-14 text-center transition-all duration-200 touch-manipulation backdrop-blur-xl ${
                isDragOver
                  ? 'border-white bg-white/10 scale-[1.01]'
                  : 'border-white/20 bg-studio-900/70 hover:border-white/40 hover:bg-studio-900/90'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg shadow-black/40">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    Choose your audio files
                  </p>
                  <p className="text-sm text-slate-300 mt-1.5 font-medium">
                    Tap to browse or drop{' '}
                    <span className="text-white font-bold">.mp3</span>,{' '}
                    <span className="text-white font-bold">.wav</span>,{' '}
                    <span className="text-white font-bold">.aac</span>, or{' '}
                    <span className="text-white font-bold">.m4a</span>
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] text-white font-mono font-medium border border-white/10">
                  <span>Local-first • Processed in browser</span>
                </div>
              </div>
            </div>

            {/* Idle Guidance Card */}
            <div className="w-full max-w-lg rounded-2xl bg-studio-900/50 backdrop-blur-md border border-white/10 p-5 text-center shadow-lg shadow-black/40">
              <p className="text-xs font-bold text-white">
                Mathematical Varispeed Resampler
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1.5 font-medium">
                Tape-style speed & pitch locking using{' '}
                <code className="text-white font-mono font-bold text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
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
              <div className="studio-glass rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl flex items-center justify-between gap-3 border border-white/10">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-white truncate" title={activeTrack?.name}>
                      {activeTrack?.name || 'Select a track'}
                    </p>
                    <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                      {tracks.length} track{tracks.length !== 1 ? 's' : ''} loaded
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-black hover:bg-slate-200 transition active:scale-95 touch-manipulation cursor-pointer shadow-sm"
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
              <div className="studio-glass rounded-2xl p-5 backdrop-blur-xl flex flex-col gap-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">
                    SELECTIVE MIX EXPORT
                  </span>
                  <span className="text-xs font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10">
                    ≤ 320 KBPS MP3
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Combine any track subset into a seamless varispeed mix export with per-track or global pitch.
                </p>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Configure & Export Mix</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )}

      {/* Persistent Bottom Floating Transport Bar with iOS Safe Area */}
      {(tracks.length > 0 || isChillMode) && (
        <footer className="fixed bottom-0 inset-x-0 z-40 bg-studio-950/90 backdrop-blur-lg border-t border-white/10 px-4 py-3 pb-safe">
          <div className="max-w-7xl mx-auto">
            <TransportBar
              currentTrack={activeTrack}
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              duration={playback.duration}
              volume={playback.volume}
              isMuted={playback.isMuted}
              repeatMode={repeatMode}
              isShuffle={isShuffle}
              isChillMode={isChillMode}
              onTogglePlay={handleTogglePlay}
              onPrevTrack={handlePrevTrack}
              onNextTrack={handleNextTrack}
              onToggleRepeat={handleToggleRepeat}
              onToggleShuffle={handleToggleShuffle}
              onToggleChillMode={handleToggleChillMode}
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
