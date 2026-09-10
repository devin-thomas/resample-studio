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
