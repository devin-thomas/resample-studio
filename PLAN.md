# Resample Studio Plan

Status: completed

## Intended result

For musicians, sound designers, and audio creators who want precise, tactile varispeed manipulation with high-aesthetic visual feedback. Resample Studio takes Resample Studio Lite to a professional tier: full -1200 to +1200 cents pitch control with configurable step sizes and custom range caps, independent/opposite speed control (25% to 400% with 0.1% precision), expanded format support (MP3, WAV, AAC, M4A), multi-track playlist with per-track locks, selective multi-track mix concatenation export (<=320kbps MP3), and a mesmerizing 120Hz Three.js audio-reactive visual surface.

Target URL: `https://resample-studio.vercel.app`  
Repository: `https://github.com/devin-thomas/resample-studio`

## Included

1. **Dual Tactile Knobs (Pitch & Speed)**:
   - Pitch: -1200 to +1200 cents, step selector 1-100, basic symmetric hundreds cap vs. advanced arbitrary min/max limits. Drag, mouse wheel, and direct numeric keyboard entry.
   - Speed: 25% to 400%, 0.1% precision, with matching drag, wheel, and typing controls.
   - Varispeed link mode (FL Studio style: pitch & speed physically coupled) and separate control options.
2. **Expanded Audio Ingestion & Playback Engine**:
   - Ingest MP3, WAV, AAC, and M4A.
   - iOS background playback & MediaSession integration (preserving the HTMLAudioElement routing proven in Lite v1.02).
3. **Playlist & Per-Track Locks**:
   - Multi-file drag-and-drop playlist with track ordering, previous/next controls, and active waveform scrub.
   - Per-track setting locks: choose whether knobs affect all tracks globally or track-specific settings recall automatically.
4. **Selective Multi-Track Mix Export**:
   - Select arbitrary subsets of playlist tracks (e.g. track 1 only, 1-3, 1/3/5, or all).
   - Concatenate into a single continuous MP3 (<=320kbps) using client-side Web Audio offline rendering & MP3 encoding.
5. **High-Craft 120Hz Three.js Audio Visualizer**:
   - GPU-accelerated 3D audio-reactive scene responding dynamically to frequency and amplitude data.
   - Inspired by `visual-ceiling.vercel.app` and `aicodingdictionary.com`, optimized for 120Hz mobile and desktop displays.
6. **Deployment & Verification**:
   - GitHub push to `devin-thomas/resample-studio`.
   - Vercel production deployment to `resample-studio.vercel.app`.

## Outside this build

- Server-side database / user authentication accounts (local-first browser workflow preserves privacy and zero latency).
- Cloud AI stems separation or audio mastering beyond varispeed concatenation.
- Uncompressed WAV/FLAC export (MP3 <=320kbps target explicitly specified).

## Delivery sequence

1. **Scaffolding & Core Architecture** (`tickets/01-project-scaffold.md`): Vite + React + TypeScript + Tailwind CSS + Three.js baseline.
2. **Audio Engine & Resample Math** (`tickets/02-audio-engine-and-varispeed.md`): Web Audio Context + HTMLAudioElement pipeline supporting MP3/WAV/AAC/M4A with exact varispeed math ($2^{\text{cents}/1200}$).
3. **Tactile Dual Knobs** (`tickets/03-tactile-knobs-pitch-speed.md`): Pitch (-1200 to +1200) and Speed (25% to 400%) knobs with drag, wheel, numeric typing, step selection (1-100), and basic/advanced range capping.
4. **Playlist Queue & Track Locking** (`tickets/04-playlist-and-per-track-locks.md`): Multi-file playlist, next/prev navigation, and per-track knob parameter locks.
5. **120Hz Three.js Audio Reactive Visualizer** (`tickets/05-threejs-audio-reactive-visualizer.md`): Real-time WebGL audio visualization responding to AnalyserNode FFT data.
6. **Multi-Track Concatenation & MP3 Export** (`tickets/06-multi-track-concatenation-export.md`): Offline audio rendering of selected track subsets and client-side MP3 encoding (<=320kbps).
7. **Mobile Polish & PWA Controls** (`tickets/07-mobile-pwa-and-ios-polish.md`): Touch gesture tuning, 120Hz viewport meta, iOS MediaSession/Now Playing support.
8. **Git Push & Vercel Deployment** (`tickets/08-github-and-vercel-deployment.md`): Create public GitHub repo `resample-studio` and deploy to `resample-studio.vercel.app`.

## Completion

- Observable primary flow: Upload multiple AAC/M4A/MP3/WAV files -> Play through 120Hz visualizer -> Tweak pitch knob with drag/wheel/typing and 1-100 step -> Lock settings to track -> Select mix tracks -> Export <=320kbps MP3 -> Verified on desktop and mobile Safari.
- Durable source destination: `https://github.com/devin-thomas/resample-studio`.
- Live destination: `https://resample-studio.vercel.app`.

## Approval

Awaiting learner go-ahead.
