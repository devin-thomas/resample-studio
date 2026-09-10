# Resample Studio Specification

## Audience and purpose

Designed for beatmakers, producers, audio enthusiasts, and creators needing precision varispeed resample playback and concatenation on both phone and desktop, with an aesthetic and interactive visual environment.

## Primary flow

1. **Input**: User drops or selects one or more audio files (`.mp3`, `.wav`, `.aac`, `.m4a`).
2. **Playlist**: Files populate an interactive playlist. Track 1 begins playback or stands ready.
3. **Manipulation**:
   - User adjusts the **Pitch Knob** (-1200 to +1200 cents). They adjust step size (1 to 100 cents), drag the knob with mouse/touch, scroll with the wheel, or type directly into the numerical badge.
   - User adjusts or observes the **Speed Knob** (25.0% to 400.0%, one decimal place).
   - In linked varispeed mode, moving pitch recalculates speed via $S = 2^{\text{cents}/1200}$ and vice versa.
   - User can lock a track's settings so switching tracks recalls individual pitch/speed profiles, or leave unlocked for global control.
4. **Visual Experience**: While playing, an audio-reactive 3D surface (Three.js WebGL canvas) reacts dynamically to bass, mids, and treble at up to 120 FPS.
5. **Output**: User selects specific playlist items (e.g. tracks 1 & 3, or all) and clicks "Export Mix". The client concatenates the rendered tracks into a clean <=320kbps MP3 download.

## Required behavior

- **Audio File Support**: Robust decoding via Web Audio API `decodeAudioData` and fallback `HTMLAudioElement` for AAC/M4A.
- **Pitch Range & Step**: Default limits -1200 to +1200 cents. Basic capping enables setting symmetric hundreds (e.g. ±300, ±600, ±1200). Advanced capping enables arbitrary min/max limits (e.g. -450 cents to +720 cents). Step selector determines increment (1 to 100 cents).
- **Speed Range & Precision**: 25.0% to 400.0%. Precision strictly clamped to 1 decimal place (e.g. 152.4%).
- **Playlist Controls**: Previous track, Next track, Play/Pause, Loop, Waveform progress scrubber.
- **Track Setting Locks**: A toggle per track: "Lock Settings". When enabled, adjusting knobs stores values on that track. When switching tracks, the active knobs animate to that track's saved settings.
- **Mix Export**: Checkboxes on playlist rows to include in export. Option to export under global knob values or per-track locked values. Client-side audio concatenation with progress indicator and MP3 download trigger.
- **iOS Resilience**: Maintain playback routing through `HTMLAudioElement` / Web Audio node graph to prevent iOS background sleep and enable Dynamic Island / lockscreen controls.
- **Empty States**: Friendly dropzone with demo audio option if user has no file immediately on hand.
- **Error States**: Clear notification if an uploaded file is corrupted or unsupported, with graceful fallback.

## Content and presentation

- **Visual Direction**: High-craft dark studio aesthetic inspired by `visual-ceiling.vercel.app` and `aicodingdictionary.com`. Tactile metallic / neon skeuomorphic digital knobs, glassmorphism panels, crisp typography (Geist / Inter / JetBrains Mono).
- **Audio Visualizer**: Three.js particle mesh / wave ribbon with bloom effects that pulses with audio frequency bins.
- **Responsive Parity**: Fluid touch-friendly layout on iOS/Android and full desktop precision.
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
