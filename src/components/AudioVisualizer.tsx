import React, { useEffect, useRef, useState } from 'react';
import { ModeId } from '../visualizer/types';
import { VisualizerRuntime } from '../visualizer/runtime';
import { TapeVisualization } from '../visualizer/modes/Tape';
import { GravityVisualization } from '../visualizer/modes/Gravity';
import { TerrainVisualization } from '../visualizer/modes/Terrain';

interface AudioVisualizerProps {
  hasFooter?: boolean;
  presentation?: 'studio' | 'chill';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  hasFooter = false,
  presentation = 'studio',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<VisualizerRuntime | null>(null);
  const [mode, setMode] = useState<ModeId>('tape');
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const runtime = new VisualizerRuntime(container, (measuredFps) => {
      setFps(measuredFps);
    });

    runtime.registerMode('tape', () => new TapeVisualization());
    runtime.registerMode('gravity', () => new GravityVisualization());
    runtime.registerMode('terrain', () => new TerrainVisualization());

    runtime.setPresentation(presentation);
    runtime.setMode(mode);

    runtimeRef.current = runtime;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  // Update mode without reconstructing renderer
  useEffect(() => {
    runtimeRef.current?.setMode(mode);
  }, [mode]);

  // Update presentation mode (studio vs chill)
  useEffect(() => {
    runtimeRef.current?.setPresentation(presentation);
  }, [presentation]);

  const modes: ModeId[] = ['tape', 'gravity', 'terrain'];

  return (
    <>
      {/* Full-Bleed Background Canvas (ADR 6) */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-0 select-none overflow-hidden"
        style={{
          touchAction: presentation === 'chill' ? 'pinch-zoom' : 'pan-y pinch-zoom',
        }}
      />

      {/* Floating Visualizer Controls Pill */}
      <div
        data-visualizer-ignore="true"
        className={`fixed right-3 sm:right-4 z-30 flex items-center gap-1.5 bg-studio-950/80 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg transition-all duration-200 ${
          hasFooter ? 'bottom-28 sm:bottom-28' : 'bottom-6 sm:bottom-6'
        }`}
      >
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase transition-all cursor-pointer font-bold ${
              mode === m
                ? 'bg-white text-black shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="text-[10px] font-mono text-slate-300 font-bold border-l border-white/10 pl-1.5 ml-0.5 min-w-[28px] text-center">
          {fps !== null ? fps : '—'}
        </span>
      </div>
    </>
  );
};
