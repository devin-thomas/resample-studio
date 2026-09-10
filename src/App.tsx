import { useState, useEffect, useCallback } from 'react';
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

  // Load demo track initially so user can test right away
  useEffect(() => {
    const demo = createDemoTrack();
    setTracks([demo]);
    setActiveTrackId(demo.id);
  }, []);

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
      {/* Studio Header */}
      <header className="border-b border-white/10 bg-studio-900/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
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
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="py-1.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Mix</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher (Visible on mobile only) */}
      <div className="lg:hidden flex border-b border-white/10 bg-studio-900/60 px-4 py-2 gap-2">
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

      {/* Main Studio Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mb-24">
        {/* Left Column: 120Hz Visualizer & Tactile Knobs */}
        <div
          className={`lg:col-span-7 xl:col-span-8 flex flex-col gap-6 ${
            mobileTab === 'playlist' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Three.js Audio-Reactive 3D Visual Surface */}
          <AudioVisualizer />

          {/* Master Tactile Dual Knobs Panel */}
          <KnobControlPanel
            settings={knobSettings}
            onChange={handleKnobChange}
            onReset={handleKnobReset}
          />
        </div>

        {/* Right Column: Playlist Queue & Quick Concatenation Export */}
        <div
          className={`lg:col-span-5 xl:col-span-4 flex flex-col gap-6 ${
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
          <div className="studio-glass rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                SELECTIVE MIX EXPORT
              </span>
              <span className="text-xs font-mono text-cyan-400">$\le 320$ KBPS MP3</span>
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
      </main>

      {/* Persistent Bottom Floating Transport Bar with iOS Safe Area */}
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
