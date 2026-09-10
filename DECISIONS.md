# Resample Studio Decisions

## 1. Client-Side Audio Stack & iOS Background Routing

Status: accepted

Context: iOS Safari suspends plain `AudioContext` instances when the device locks or the user switches tabs, breaking background audio and Dynamic Island integration.

Decision: Preserve the dual-pipeline architecture proven in Resample Studio Lite: route audio through an `HTMLAudioElement` connected to `AudioContext.createMediaElementSource()` for live playback, coupled with `OfflineAudioContext` and a client-side MP3 encoder (`lamejs` / WebAssembly) for rendering exports.

Reason: Guarantees continuous background playback on iOS while enabling real-time frequency analysis (`AnalyserNode`) for Three.js and fast offline concatenation.

Consequences: MediaElementSource on iOS requires user-gesture initiation on the first track load.

## 2. Linked Varispeed Math Formula

Status: accepted

Context: Musicians require mathematically exact musical varispeed relationships identical to hardware samplers and FL Studio Resample mode.

Decision: Implement exact exponential varispeed formulas:
- Pitch to Speed: $\text{Speed Ratio} = 2^{\frac{\text{cents}}{1200}}$ (e.g. $0\text{ cents} = 1.0 = 100.0\%$; $+1200\text{ cents} = 2.0 = 200.0\%$; $-1200\text{ cents} = 0.5 = 50.0\%$; $+600\text{ cents} = 2^{0.5} \approx 141.4\%$).
- Speed to Pitch: $\text{cents} = 1200 \times \log_2(\frac{\text{speed}\%}{100})$.
- Rounding: Speed input/display clamps strictly to 1 decimal place.

Reason: Consistent, predictable acoustic results that match musician expectations.

## 3. Visual Framework: Three.js with Custom Shader & 120Hz Loop

Status: accepted

Context: User requested an exciting, visually rich experience inspired by `visual-ceiling.vercel.app` and `aicodingdictionary.com` targeting high refresh rates (120Hz).

Decision: Use Three.js with an optimized WebGL canvas featuring an audio-reactive 3D waveform/particle field driven by Web Audio FFT frequency bins. Wrap animation inside an adaptive timestamp `requestAnimationFrame` loop that runs at the native display refresh rate (including ProMotion 120Hz) with automatic fallback for lower power devices.

Reason: Delivers the aesthetic delight requested without stalling the audio thread.

## 4. Client-Side MP3 Concatenation Engine

Status: accepted

Context: User wants to export selected playlist tracks as a single concatenated mix up to 320kbps MP3 without a backend server.

Decision: Use `OfflineAudioContext` to render the selected tracks sequentially with their applied varispeed settings into a single `AudioBuffer`, then encode that buffer into MP3 using `lamejs` running in a dedicated Web Worker.

Reason: Fast, private, runs entirely on the user's phone or computer without uploading gigabytes of audio to an external server.

## 5. Upload-First Empty State (No Pre-loaded Demo)

Status: accepted

Context: The initial implementation auto-loaded a synthesized demo track on mount. This means a musician arriving at the app immediately hears someone else's music, personalizing the experience to that demo rather than their own creative intent. Resample Studio Lite's UX proved that starting empty with a prominent upload dropzone followed by progressive disclosure of controls is the correct pipeline.

Decision: Remove the `useEffect` that auto-loads `createDemoTrack()` on mount. The app starts with an empty state showing a prominent upload dropzone. All playback controls, knobs, and transport are hidden or disabled until the user uploads their first track. Retain the "Load Demo" button in the header as a secondary action for users who want to explore the tool without their own audio.

Reason: Musicians should personalize their own experience. The tool's job is to process their music, not to showcase a built-in beat. Resample Studio Lite validated this pattern: upload → play → manipulate → export.

Consequences: First-time users see an empty state. The demo button provides a low-friction escape hatch for exploration.

## 6. Full-Bleed Visualization Background

Status: accepted

Context: The Three.js visualizer was rendered inside a bordered, aspect-ratio-constrained box (`aspect-video md:aspect-[21/9] min-h-[260px]`) that consumed significant above-the-fold real estate while pushing the knobs and upload below the viewport. The visualizer doesn't need containment — it can be the entire background of the page.

Decision: Render the Three.js canvas as a fixed, full-viewport background layer (`position: fixed; inset: 0; z-index: 0`) behind all UI content. Remove the bordered container, aspect ratio constraints, and the space it occupied in the grid layout. The visualizer runs a subtle ambient animation when no audio is playing and transitions to full audio-reactive mode during playback. UI panels render above it with glassmorphism backdrop-blur.

Reason: Eliminates the largest above-the-fold space consumer, allowing upload and knobs to be immediately visible. Creates an immersive, borderless visual experience that doesn't compete with controls for screen real estate.

Consequences: All UI panels need sufficient contrast/blur against the dynamic background. The visualizer mode selector moves to a small floating pill overlay. Performance profile unchanged. See [docs/VISUALIZATIONS.md](docs/VISUALIZATIONS.md) for full architecture and development specs.

## 7. Improved Visualization Mouse/Touch Responsiveness

Status: accepted

Context: The current mouse interaction with the vortex visualization feels sluggish and disconnected. The lerp factor is 0.05 (5% per frame), meaning the scene takes ~60 frames to catch up to the cursor. The rotation range is limited to ±0.6 radians horizontal and ±0.4 radians vertical, which feels like the visualization barely moves.

Decision: Increase the lerp smoothing factor from 0.05 to 0.12 for snappier response. Increase rotation range from ±0.6/±0.4 to ±1.2/±0.8 radians. Add momentum/inertia: track velocity of mouse movement and apply residual rotation that decays over time when the mouse stops or leaves the viewport, so the scene feels like it has physical weight and continues drifting.

Reason: The interaction should feel physical — like pushing a suspended object. Quick mouse movements should create visible, satisfying responses, and the scene should coast to a stop rather than freezing the instant the mouse stops.

Consequences: Maximum velocity is clamped to prevent disorienting spin. Touch interaction on mobile uses the same momentum system.

## 8. Native Hardware Output for iOS Background Audio & Buffer-Based Analysis

Status: accepted

Context: When audio is routed through `AudioContext.createMediaElementSource()` into `audioCtx.destination`, iOS Safari aggressively suspends the `AudioContext` when the user locks their screen, switches apps, or leaves Safari, causing immediate silence. In Resample Studio Lite, audio played continuously in the background because the `HTMLAudioElement` was appended directly to the DOM and played natively to the hardware output without Web Audio destination routing.

Decision:
1. The `HTMLAudioElement` outputs directly to hardware speakers with `playsinline`, `webkit-playsinline`, and `id="resample-media-player"`. It is never routed through `createMediaElementSource(el).connect(destination)`.
2. AudioBuffer is decoded asynchronously on track load for real-time waveform extraction and discrete spectral FFT analysis while the page is visible.
3. Full MediaSession integration with 512x512 vinyl artwork, live position syncing, and Lock Screen / Dynamic Island controls (`play`, `pause`, `previoustrack`, `seekto`).

Reason: Guarantees 100% reliable background playback on iOS when leaving Safari or locking the device, while still providing rich real-time frequency reactivity for Three.js when the app is active.

Consequences: Background playback is rock solid. Real-time visualizer data is decoupled from audio output hardware routing.

