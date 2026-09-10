# Resample Studio Specification

## Audience and purpose

Designed for beatmakers, producers, audio enthusiasts, and creators needing precision varispeed resample playback and concatenation on both phone and desktop, with an aesthetic and interactive visual environment.

## Primary flow

1. **Landing**: User arrives at a clean, empty studio. A prominent upload dropzone occupies the primary visual position above the fold. The Three.js visualizer runs as a subtle ambient full-page background. No demo audio is pre-loaded.
2. **Input**: User drops or selects one or more audio files (`.mp3`, `.wav`, `.aac`, `.m4a`). The dropzone collapses into a compact file card. Controls and knobs become active.
3. **Manipulation**:
   - User adjusts the **Pitch Knob** (-1200 to +1200 cents). They adjust step size (1 to 100 cents), drag the knob with mouse/touch, scroll with the wheel, or type directly into the numerical badge.
   - User adjusts or observes the **Speed Knob** (25.0% to 400.0%, one decimal place).
   - In linked varispeed mode, moving pitch recalculates speed via $S = 2^{\text{cents}/1200}$ and vice versa.
   - User can lock a track's settings so switching tracks recalls individual pitch/speed profiles, or leave unlocked for global control.
4. **Visual Experience**: The full-bleed Three.js background features three distinct tactile worlds: **Tape** (flagship ribbon with traveling waves and grab physics), **Gravity** (orbital force field with localized attractor/repulsor dynamics and shockwaves), and **Terrain** (continuous procedural scrolling height-field with lateral steering). Spectral and transient analysis is decoupled into a background Web Worker, ensuring zero audio jitter and physical momentum across both 60Hz and 120Hz displays.
5. **Output**: User selects specific playlist items (e.g. tracks 1 & 3, or all) and clicks "Export Mix". The client concatenates the rendered tracks into a clean <=320kbps MP3 download.

## Required behavior

- **Audio File Support**: Robust decoding via Web Audio API `decodeAudioData` and fallback `HTMLAudioElement` for AAC/M4A.
- **Pitch Range & Step**: Default limits -1200 to +1200 cents. Basic capping enables setting symmetric hundreds (e.g. ±300, ±600, ±1200). Advanced capping enables arbitrary min/max limits (e.g. -450 cents to +720 cents). Step selector determines increment (1 to 100 cents).
- **Speed Range & Precision**: 25.0% to 400.0%. Precision strictly clamped to 1 decimal place (e.g. 152.4%).
- **Playlist Controls**: Previous track, Next track, Play/Pause, Loop, Waveform progress scrubber.
- **Track Setting Locks**: A toggle per track: "Lock Settings". When enabled, adjusting knobs stores values on that track. When switching tracks, the active knobs animate to that track's saved settings.
- **Mix Export**: Checkboxes on playlist rows to include in export. Option to export under global knob values or per-track locked values. Client-side audio concatenation with progress indicator and MP3 download trigger.
- **iOS Resilience**: Maintain playback routing through `HTMLAudioElement` / Web Audio node graph to prevent iOS background sleep and enable Dynamic Island / lockscreen controls.
- **Empty States**: Clean, prominent upload dropzone with progressive disclosure. Controls and knobs are hidden until the user uploads their first track. A secondary "Load Demo" button in the header provides an exploration fallback.
- **Error States**: Clear notification if an uploaded file is corrupted or unsupported, with graceful fallback.

## Content and presentation

- **Visual Direction**: High-craft dark studio aesthetic inspired by `visual-ceiling.vercel.app` and `aicodingdictionary.com`. Tactile metallic / neon skeuomorphic digital knobs, glassmorphism panels, crisp typography (Geist / Inter / JetBrains Mono).
- **Audio Visualizer**: Full-viewport background layer (not contained in a bordered box). Three.js particle mesh / wave ribbon with bloom effects that runs as subtle ambient animation on idle and transitions to full audio-reactive mode during playback. Mouse/touch interaction features momentum-based inertia for a physical, satisfying feel. See [Visualization Technical Guide](docs/VISUALIZATIONS.md) for architecture, inputs/outputs, and module interfaces.
- **Responsive Parity**: Fluid touch-friendly layout on iOS/Android and full desktop precision. Upload dropzone and pitch/speed knobs must be fully visible above the fold on both desktop (1440px height) and mobile (iPhone SE through iPhone 16 Pro Max viewport) without scrolling.
- **Smooth 120Hz**: Animation loops optimized via `requestAnimationFrame` and timestamp delta clamping.

## Boundaries

- Local-first: All audio processing runs 100% client-side in the browser. Zero server audio uploads required.
- Exports are strictly MP3 format at up to 320kbps.

## Acceptance

1. Pitch knob rotates smoothly via drag, responds to mouse wheel, accepts direct numerical input, steps by chosen increment (1-100), and respects basic and arbitrary range caps.
2. Speed knob operates from 25.0% to 400.0% with 1-decimal precision.
3. Multiple files (including AAC and M4A) load into playlist and play consecutively.
4. Per-track parameter locking preserves independent settings across playlist track switches.
5. Multi-track selective concatenation exports a playable MP3 file.
6. Three.js visualizer renders smoothly and reacts to audio playback in real time.
7. Deployed to Vercel at `https://resample-studio.vercel.app` and verified live.
