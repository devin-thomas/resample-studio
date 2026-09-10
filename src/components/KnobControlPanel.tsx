import React, { useState } from 'react';
import { Knob } from './Knob';
import { KnobSettings, KnobsLinkMode } from '../types/audio';
import {
  centsToSpeedPercent,
  speedPercentToCents,
} from '../audio/resampleMath';
import { Sliders, Gauge, Unlink, RotateCcw, Settings2 } from 'lucide-react';

interface KnobControlPanelProps {
  settings: KnobSettings;
  onChange: (updated: KnobSettings) => void;
  onReset: () => void;
}

export const KnobControlPanel: React.FC<KnobControlPanelProps> = ({
  settings,
  onChange,
  onReset,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pitch change handler
  const handlePitchChange = (newCents: number) => {
    let newSpeed = settings.speedPercent;
    if (settings.linkMode === 'pitch' || settings.linkMode === 'speed') {
      newSpeed = centsToSpeedPercent(newCents);
    }
    onChange({
      ...settings,
      pitchCents: newCents,
      speedPercent: newSpeed,
    });
  };

  // Speed change handler
  const handleSpeedChange = (newSpeed: number) => {
    let newCents = settings.pitchCents;
    if (settings.linkMode === 'pitch' || settings.linkMode === 'speed') {
      newCents = speedPercentToCents(newSpeed);
    }
    onChange({
      ...settings,
      speedPercent: newSpeed,
      pitchCents: newCents,
    });
  };

  // Step change (1 to 12 cents)
  const handleStepChange = (step: number) => {
    const clampedStep = Math.max(1, Math.min(12, step));
    onChange({ ...settings, centsStep: clampedStep });
  };

  // Link mode change: 'pitch' | 'speed' | 'unlinked'
  const handleModeChange = (mode: KnobsLinkMode) => {
    let speed = settings.speedPercent;
    let cents = settings.pitchCents;
    if (mode === 'pitch') {
      speed = centsToSpeedPercent(settings.pitchCents);
    } else if (mode === 'speed') {
      cents = speedPercentToCents(settings.speedPercent);
    }
    onChange({
      ...settings,
      linkMode: mode,
      speedPercent: speed,
      pitchCents: cents,
    });
  };

  // Basic cap change (symmetric hundreds)
  const handleBasicCapChange = (hundreds: number) => {
    const cap = Math.max(100, Math.min(1200, Math.round(hundreds / 100) * 100));
    onChange({
      ...settings,
      basicCap: cap,
      pitchCents: Math.max(-cap, Math.min(cap, settings.pitchCents)),
    });
  };

  // Effective min/max for Pitch
  const pitchMin =
    settings.capMode === 'basic' ? -settings.basicCap : settings.advancedMinCents;
  const pitchMax =
    settings.capMode === 'basic' ? settings.basicCap : settings.advancedMaxCents;

  // Effective min/max for Speed
  const speedMin =
    settings.capMode === 'basic' ? 25.0 : settings.advancedMinSpeed;
  const speedMax =
    settings.capMode === 'basic' ? 400.0 : settings.advancedMaxSpeed;

  const stepPresets = [1, 2, 3, 4, 5, 6, 10, 12];

  return (
    <div className="studio-glass rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-white" />
            <h2 className="font-bold text-xs sm:text-sm tracking-wider text-white uppercase">
              Tactile Varispeed Controls
            </h2>
          </div>

          {/* Reset Button on Mobile Header */}
          <button
            type="button"
            onClick={onReset}
            className="sm:hidden p-1.5 rounded-lg bg-studio-900 hover:bg-studio-800 border border-white/10 text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Reset knobs to default (0¢ / 100.0%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* PITCH / SPEED / UNLINKED Mode Toggle + Desktop Reset */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-1 bg-studio-950 p-1 rounded-xl border border-white/10 flex-1 sm:flex-initial">
            {/* Mode 1: PITCH-CONTROLLED */}
            <button
              type="button"
              onClick={() => handleModeChange('pitch')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                settings.linkMode === 'pitch'
                  ? 'bg-studio-800 text-white border border-white/30 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Pitch-Controlled: Pitch is primary, speed recalculates automatically"
            >
              <Sliders className="w-3.5 h-3.5 text-white" />
              <span>PITCH</span>
            </button>

            {/* Mode 2: SPEED-CONTROLLED */}
            <button
              type="button"
              onClick={() => handleModeChange('speed')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                settings.linkMode === 'speed'
                  ? 'bg-studio-800 text-white border border-white/30 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Speed-Controlled: Speed is primary, pitch recalculates automatically"
            >
              <Gauge className="w-3.5 h-3.5 text-white" />
              <span>SPEED</span>
            </button>

            {/* Mode 3: UNLINKED (Red Icon) */}
            <button
              type="button"
              onClick={() => handleModeChange('unlinked')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                settings.linkMode === 'unlinked'
                  ? 'bg-studio-800 text-white border border-red-500/40 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Unlinked: Pitch and Speed adjust independently"
            >
              <Unlink className="w-3.5 h-3.5 text-red-500" />
              <span>UNLINKED</span>
            </button>
          </div>

          {/* Desktop Reset Button */}
          <button
            type="button"
            onClick={onReset}
            className="hidden sm:flex p-2 rounded-xl bg-studio-950 hover:bg-studio-800 border border-white/10 text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Reset knobs to 0 cents / 100.0%"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Dual Knobs Area: Side-by-Side on both mobile and desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 py-1">
        {/* Pitch Knob */}
        <div className={`flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-studio-900/50 border transition-all relative ${
          settings.linkMode === 'pitch' ? 'border-white/30 ring-1 ring-white/10 shadow-md shadow-black/40' : 'border-white/10'
        }`}>
          <Knob
            label="PITCH"
            value={settings.pitchCents}
            min={pitchMin}
            max={pitchMax}
            step={settings.centsStep}
            unit="¢"
            defaultValue={0}
            decimals={0}
            accentColor="cyan"
            disabled={settings.linkMode === 'speed'}
            disabledReason="Pitch is locked to speed in Speed mode"
            onChange={handlePitchChange}
            formatDisplay={(val) => `${val > 0 ? '+' : ''}${val}¢ (${(val / 100).toFixed(1)}st)`}
          />
          <div className="mt-2 text-[10px] sm:text-[11px] font-mono text-center font-medium">
            {settings.linkMode === 'speed' ? (
              <span className="text-slate-300 bg-studio-950 px-2 py-0.5 rounded-full border border-white/10 font-bold text-[10px]">
                DRIVEN BY SPEED
              </span>
            ) : (
              <span className="text-slate-200">
                Step: <span className="text-white font-bold">{settings.centsStep}¢</span>
              </span>
            )}
          </div>
        </div>

        {/* Speed Knob */}
        <div className={`flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-studio-900/50 border transition-all relative ${
          settings.linkMode === 'speed' ? 'border-white/30 ring-1 ring-white/10 shadow-md shadow-black/40' : 'border-white/10'
        }`}>
          <Knob
            label="SPEED"
            value={settings.speedPercent}
            min={speedMin}
            max={speedMax}
            step={settings.linkMode === 'unlinked' ? 0.5 : 0.1}
            unit="%"
            defaultValue={100.0}
            decimals={1}
            accentColor="amber"
            disabled={settings.linkMode === 'pitch'}
            disabledReason="Speed is locked to pitch in Pitch mode"
            onChange={handleSpeedChange}
            formatDisplay={(val) => `${val.toFixed(1)}% (${(val / 100).toFixed(2)}x)`}
          />
          <div className="mt-2 text-[10px] sm:text-[11px] font-mono text-center font-medium">
            {settings.linkMode === 'pitch' ? (
              <span className="text-slate-300 bg-studio-950 px-2 py-0.5 rounded-full border border-white/10 font-bold text-[10px]">
                DRIVEN BY PITCH
              </span>
            ) : (
              <span className="text-slate-200">
                Res: <span className="text-white font-bold">0.1%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step Selector & Range Capping: 1–12 cents range */}
      <div className="bg-studio-900/70 rounded-2xl p-3.5 sm:p-4 border border-white/10 flex flex-col gap-3">
        {/* Step Selector Row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-200">
            <span className="font-bold text-[11px] sm:text-xs">STEP INCREMENT (1–12¢):</span>
            <span className="text-white font-bold text-xs bg-studio-950 px-2 py-0.5 rounded-md border border-white/10">
              {settings.centsStep} ¢
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1 sm:gap-1.5">
            {stepPresets.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStepChange(s)}
                className={`py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer text-center ${
                  settings.centsStep === s
                    ? 'bg-white text-black shadow'
                    : 'bg-studio-950 text-slate-200 hover:text-white border border-white/5 hover:border-white/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Fine Step Range Slider (1 to 12) */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-mono text-slate-300 font-medium">1¢</span>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={settings.centsStep}
              onChange={(e) => handleStepChange(Number(e.target.value))}
              className="flex-1 h-1.5 bg-studio-950 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <span className="text-[10px] font-mono text-slate-300 font-medium">12¢</span>
          </div>
        </div>

        {/* Range Capping Selector: Basic vs Advanced */}
        <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200">RANGE:</span>
            <div className="inline-flex rounded-xl bg-studio-950 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => onChange({ ...settings, capMode: 'basic' })}
                className={`px-2.5 py-1 text-[11px] sm:text-xs font-mono rounded-lg transition-all cursor-pointer font-bold ${
                  settings.capMode === 'basic'
                    ? 'bg-studio-800 text-white shadow-sm border border-white/10'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ±Hundreds
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...settings, capMode: 'advanced' })}
                className={`px-2.5 py-1 text-[11px] sm:text-xs font-mono rounded-lg transition-all cursor-pointer font-bold ${
                  settings.capMode === 'advanced'
                    ? 'bg-studio-800 text-white shadow-sm border border-white/10'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {settings.capMode === 'basic' ? (
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <span className="text-xs font-mono text-slate-200 font-medium">Limit:</span>
              <select
                value={settings.basicCap}
                onChange={(e) => handleBasicCapChange(Number(e.target.value))}
                className="bg-studio-950 border border-white/15 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-white"
              >
                <option value={100}>±100¢ (±1st)</option>
                <option value={200}>±200¢ (±2st)</option>
                <option value={300}>±300¢ (±3st)</option>
                <option value={500}>±500¢ (±5st - 4th)</option>
                <option value={600}>±600¢ (±6st - tritone)</option>
                <option value={700}>±700¢ (±7st - 5th)</option>
                <option value={1200}>±1200¢ (±12st - 1 Octave)</option>
              </select>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-mono font-bold text-white hover:text-slate-200 cursor-pointer self-start sm:self-auto"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Bounds' : 'Configure Bounds'}</span>
            </button>
          )}
        </div>

        {/* Advanced Limit Configuration Drawers */}
        {settings.capMode === 'advanced' && showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10 bg-studio-950/80 p-3 rounded-xl">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-white font-bold">
                Pitch Bounds (-1200 to +1200¢):
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-200 font-medium">Min:</label>
                <input
                  type="number"
                  min="-1200"
                  max="0"
                  value={settings.advancedMinCents}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMinCents: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/20 rounded-lg font-mono text-xs font-bold text-white"
                />
                <label className="text-xs font-mono text-slate-200 font-medium ml-1">Max:</label>
                <input
                  type="number"
                  min="0"
                  max="1200"
                  value={settings.advancedMaxCents}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMaxCents: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/20 rounded-lg font-mono text-xs font-bold text-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-white font-bold">
                Speed Bounds (25% to 400%):
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-200 font-medium">Min:</label>
                <input
                  type="number"
                  step="0.1"
                  min="25.0"
                  max="100.0"
                  value={settings.advancedMinSpeed}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMinSpeed: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/20 rounded-lg font-mono text-xs font-bold text-white"
                />
                <label className="text-xs font-mono text-slate-200 font-medium ml-1">Max:</label>
                <input
                  type="number"
                  step="0.1"
                  min="100.0"
                  max="400.0"
                  value={settings.advancedMaxSpeed}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMaxSpeed: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/20 rounded-lg font-mono text-xs font-bold text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

