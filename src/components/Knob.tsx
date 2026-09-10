import React, { useState, useRef, useEffect, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue?: number;
  decimals?: number;
  accentColor?: 'cyan' | 'amber' | 'purple';
  disabled?: boolean;
  disabledReason?: string;
  onChange: (val: number) => void;
  formatDisplay?: (val: number) => string;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  defaultValue = 0,
  decimals = 0,
  accentColor = 'cyan',
  disabled = false,
  disabledReason,
  onChange,
  formatDisplay,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartVal = useRef(0);
  const knobRef = useRef<HTMLDivElement>(null);

  // Map value to angle (-135 deg to +135 deg = 270 deg total sweep)
  const range = max - min || 1;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  const angle = -135 + normalized * 270;

  const colorStyles = {
    cyan: {
      glow: 'shadow-[0_0_20px_rgba(0,240,255,0.3)]',
      border: 'border-cyan-400',
      track: '#00f0ff',
      text: 'text-cyan-400',
      gradient: 'from-cyan-400 to-blue-500',
    },
    amber: {
      glow: 'shadow-[0_0_20px_rgba(255,170,0,0.3)]',
      border: 'border-amber-400',
      track: '#ffaa00',
      text: 'text-amber-400',
      gradient: 'from-amber-400 to-orange-500',
    },
    purple: {
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
      border: 'border-purple-400',
      track: '#a855f7',
      text: 'text-purple-400',
      gradient: 'from-purple-400 to-pink-500',
    },
  }[accentColor];

  const updateClampedValue = useCallback(
    (newVal: number) => {
      // Snap to step
      let snapped = Math.round(newVal / step) * step;
      if (decimals > 0) {
        snapped = Number(snapped.toFixed(decimals));
      }
      const clamped = Math.max(min, Math.min(max, snapped));
      onChange(clamped);
    },
    [min, max, step, decimals, onChange]
  );

  // Mouse / Touch Drag handling (Vertical sensitivity)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isEditing) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - e.clientY; // Upwards increases
    const sensitivity = (max - min) / 200; // 200px drag = full range
    const shiftKey = e.shiftKey; // Hold shift for fine 1/5th resolution
    const actualDelta = deltaY * (shiftKey ? sensitivity * 0.2 : sensitivity);
    updateClampedValue(dragStartVal.current + actualDelta);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  // Scroll wheel handling
  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const delta = direction * step;
    updateClampedValue(value + delta);
  };

  // Double click reset
  const handleDoubleClick = () => {
    if (disabled) return;
    updateClampedValue(defaultValue);
  };

  // Direct text editing
  const handleCommitEdit = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      updateClampedValue(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value.toString());
    }
  };

  useEffect(() => {
    if (!isEditing) {
      setEditValue(decimals > 0 ? value.toFixed(decimals) : value.toString());
    }
  }, [value, decimals, isEditing]);

  // Compute SVG arc coordinates for visual ring
  const radius = 42;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (270 / 360);
  const strokeDashoffset = arcLength * (1 - normalized);

  const displayString = formatDisplay
    ? formatDisplay(value)
    : `${decimals > 0 ? value.toFixed(decimals) : value} ${unit}`;

  return (
    <div className="flex flex-col items-center select-none group w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] sm:text-[11px] font-mono tracking-wider text-slate-200 uppercase font-bold">
          {label}
        </span>
        {disabled && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 tracking-tight">
            AUTO
          </span>
        )}
      </div>

      {/* Rotary Knob Body with Responsive Sizing */}
      <div
        ref={knobRef}
        className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center touch-none select-none transition-shadow duration-300 ${
          disabled
            ? 'cursor-default'
            : isDragging
            ? colorStyles.glow
            : 'cursor-ns-resize hover:shadow-lg hover:shadow-black/60'
        }`}
        onPointerDown={disabled ? undefined : handlePointerDown}
        onPointerMove={disabled ? undefined : handlePointerMove}
        onPointerUp={disabled ? undefined : handlePointerUp}
        onWheel={disabled ? undefined : handleWheel}
        onDoubleClick={disabled ? undefined : handleDoubleClick}
        title={
          disabled
            ? (disabledReason || 'Controlled automatically')
            : 'Drag up/down to adjust, scroll wheel, or double-click to reset'
        }
      >
        {/* SVG Progress Arc */}
        <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          {/* Background Track Arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={-circumference * 0.125}
            strokeLinecap="round"
          />
          {/* Active Colored Arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={colorStyles.track}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset - circumference * 0.125}
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Inner Physical Dial */}
        <div
          className="absolute w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-white/10 shadow-inner flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Beveled Rim */}
          <div className="absolute inset-1 rounded-full border border-white/5 bg-gradient-to-tr from-slate-900 to-slate-800" />

          {/* Position Indicator Notch */}
          <div
            className={`absolute top-1 sm:top-2 w-1 sm:w-1.5 h-2.5 sm:h-3.5 rounded-full bg-gradient-to-b ${colorStyles.gradient} shadow-[0_0_8px_currentColor]`}
          />

          {/* Center Cap */}
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-slate-950/80 border border-white/10 flex items-center justify-center">
            <div className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-${accentColor}-400/80`} />
          </div>
        </div>
      </div>

      {/* Interactive Value Badge / Direct Input - White Font */}
      <div className="mt-2 flex items-center justify-center">
        {!disabled && isEditing ? (
          <input
            type="number"
            value={editValue}
            step={step}
            min={min}
            max={max}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommitEdit}
            onKeyDown={handleKeyDown}
            className="w-24 px-2 py-1 text-center font-mono text-xs sm:text-sm bg-studio-900 border border-white/40 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-white font-bold"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsEditing(true)}
            className={`px-2.5 py-1 rounded-lg bg-studio-900/90 border border-white/15 transition-all font-mono text-xs sm:text-sm font-bold text-white shadow-sm tracking-tight ${
              disabled
                ? 'cursor-default opacity-100'
                : 'hover:bg-studio-800 hover:border-white/30 cursor-text'
            }`}
            title={disabled ? (disabledReason || 'Controlled automatically') : 'Click to type exact number'}
          >
            {displayString}
          </button>
        )}
      </div>

      {/* Min / Max bounds subtitle */}
      <div className="flex items-center justify-between w-20 sm:w-28 mt-1 text-[10px] font-mono text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
