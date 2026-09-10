import React, { useState } from 'react';
import { Knob } from './Knob';
import { KnobSettings, KnobsLinkMode } from '../types/audio';
import {
  centsToSpeedPercent,
  speedPercentToCents,
  oppositeCentsToSpeedPercent,
  oppositeSpeedPercentToCents,
} from '../audio/resampleMath';
import { Sliders, Link, Unlink, RotateCcw, Settings2, ArrowLeftRight } from 'lucide-react';

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
    if (settings.linkMode === 'linked') {
      newSpeed = centsToSpeedPercent(newCents);
    } else if (settings.linkMode === 'opposite') {
      newSpeed = oppositeCentsToSpeedPercent(newCents);
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
    if (settings.linkMode === 'linked') {
      newCents = speedPercentToCents(newSpeed);
    } else if (settings.linkMode === 'opposite') {
      newCents = oppositeSpeedPercentToCents(newSpeed);
    }
    onChange({
      ...settings,
      speedPercent: newSpeed,
      pitchCents: newCents,
    });
  };

  // Step change
  const handleStepChange = (step: number) => {
    const clampedStep = Math.max(1, Math.min(100, step));
    onChange({ ...settings, centsStep: clampedStep });
  };

  // Link mode change
  const handleModeChange = (mode: KnobsLinkMode) => {
    let speed = settings.speedPercent;
    if (mode === 'linked') {
      speed = centsToSpeedPercent(settings.pitchCents);
    } else if (mode === 'opposite') {
      speed = oppositeCentsToSpeedPercent(settings.pitchCents);
    }
    onChange({
      ...settings,
      linkMode: mode,
      speedPercent: speed,
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

  return (
    <div className="studio-glass rounded-2xl p-6 flex flex-col gap-5">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold text-sm tracking-wide text-slate-100">
            TACTILE VARISPEED DUAL CONTROLS
          </h2>
        </div>

        {/* Link / Opposite / Independent Mode Toggle */}
        <div className="flex items-center gap-1 bg-studio-900/90 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => handleModeChange('linked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.linkMode === 'linked'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="FL Studio Style: Pitch and Speed are physically coupled"
          >
            <Link className="w-3.5 h-3.5" />
            <span>LINKED</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('opposite')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.linkMode === 'opposite'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Opposite Mode: Pitch up speeds down, or pitch down speeds up"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>OPPOSITE</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('independent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.linkMode === 'independent'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Independent Mode: Independent control"
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>INDEPENDENT</span>
          </button>
        </div>

        {/* Quick Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="p-2 rounded-lg bg-studio-900/60 hover:bg-studio-800 border border-white/5 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
          title="Reset knobs to 0 cents / 100.0%"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Dual Knobs Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-2">
        {/* Pitch Knob */}
        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-studio-900/40 border border-white/5 relative">
          <Knob
            label="PITCH RESAMPLE"
            value={settings.pitchCents}
            min={pitchMin}
            max={pitchMax}
            step={settings.centsStep}
            unit="¢"
            defaultValue={0}
            decimals={0}
            accentColor="cyan"
            onChange={handlePitchChange}
            formatDisplay={(val) => `${val > 0 ? '+' : ''}${val} ¢ (${(val / 100).toFixed(1)} st)`}
          />
          <div className="mt-3 text-[11px] font-mono text-slate-500">
            Step: <span className="text-cyan-400 font-semibold">{settings.centsStep} ¢</span>
          </div>
        </div>

        {/* Speed Knob */}
        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-studio-900/40 border border-white/5 relative">
          <Knob
            label="PLAYBACK SPEED"
            value={settings.speedPercent}
            min={speedMin}
            max={speedMax}
            step={settings.linkMode === 'linked' ? 0.1 : 0.5}
            unit="%"
            defaultValue={100.0}
            decimals={1}
            accentColor="amber"
            onChange={handleSpeedChange}
            formatDisplay={(val) => `${val.toFixed(1)}% (${(val / 100).toFixed(2)}x)`}
          />
          <div className="mt-3 text-[11px] font-mono text-slate-500">
            Resolution: <span className="text-amber-400 font-semibold">0.1%</span>
          </div>
        </div>
      </div>

      {/* Step Selector (1 to 100) and Range Capping Controls */}
      <div className="bg-studio-900/60 rounded-xl p-4 border border-white/5 flex flex-col gap-4">
        {/* Step Selector 1-100 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>CENTS STEP INCREMENT (1–100):</span>
            <span className="text-cyan-400 font-bold">{settings.centsStep} ¢</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 5, 10, 25, 50, 100].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStepChange(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer ${
                  settings.centsStep === s
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-studio-800 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {s}
              </button>
            ))}
            <input
              type="range"
              min="1"
              max="100"
              value={settings.centsStep}
              onChange={(e) => handleStepChange(Number(e.target.value))}
              className="w-20 ml-2 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Range Capping Selector: Basic vs Advanced */}
        <div className="border-t border-white/5 pt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">RANGE CAPPING:</span>
            <div className="inline-flex rounded-lg bg-studio-950 p-0.5 border border-white/5">
              <button
                type="button"
                onClick={() => onChange({ ...settings, capMode: 'basic' })}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                  settings.capMode === 'basic'
                    ? 'bg-studio-800 text-cyan-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Basic (Symmetric Hundreds)
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...settings, capMode: 'advanced' })}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                  settings.capMode === 'advanced'
                    ? 'bg-studio-800 text-cyan-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Advanced (Arbitrary Limits)
              </button>
            </div>
          </div>

          {settings.capMode === 'basic' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Limit:</span>
              <select
                value={settings.basicCap}
                onChange={(e) => handleBasicCapChange(Number(e.target.value))}
                className="bg-studio-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-400"
              >
                <option value={100}>±100 ¢ (±1 st)</option>
                <option value={200}>±200 ¢ (±2 st)</option>
                <option value={300}>±300 ¢ (±3 st)</option>
                <option value={500}>±500 ¢ (±5 st - 4th)</option>
                <option value={600}>±600 ¢ (±6 st - tritone)</option>
                <option value={700}>±700 ¢ (±7 st - 5th)</option>
                <option value={1200}>±1200 ¢ (±12 st - 1 Octave)</option>
              </select>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Config' : 'Configure Min / Max'}</span>
            </button>
          )}
        </div>

        {/* Advanced Limit Configuration Drawers */}
        {settings.capMode === 'advanced' && showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/5 bg-studio-950/60 p-4 rounded-xl">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono text-slate-300 font-semibold">
                Pitch Cents Bounds (-1200 to +1200):
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-500">Min:</label>
                <input
                  type="number"
                  min="-1200"
                  max="0"
                  value={settings.advancedMinCents}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMinCents: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/10 rounded font-mono text-xs text-cyan-400"
                />
                <label className="text-xs font-mono text-slate-500 ml-2">Max:</label>
                <input
                  type="number"
                  min="0"
                  max="1200"
                  value={settings.advancedMaxCents}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMaxCents: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/10 rounded font-mono text-xs text-cyan-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono text-slate-300 font-semibold">
                Speed Percentage Bounds (25.0% to 400.0%):
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-500">Min:</label>
                <input
                  type="number"
                  step="0.1"
                  min="25.0"
                  max="100.0"
                  value={settings.advancedMinSpeed}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMinSpeed: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/10 rounded font-mono text-xs text-amber-400"
                />
                <label className="text-xs font-mono text-slate-500 ml-2">Max:</label>
                <input
                  type="number"
                  step="0.1"
                  min="100.0"
                  max="400.0"
                  value={settings.advancedMaxSpeed}
                  onChange={(e) =>
                    onChange({ ...settings, advancedMaxSpeed: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 bg-studio-900 border border-white/10 rounded font-mono text-xs text-amber-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
