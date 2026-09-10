# T-15 Visualizer Rebuild: Tape, Gravity, and Terrain

Status: closed
Depends on: T-11, T-12, T-14
References: ADR 9, docs/visualizer-rebuild/

## Work
1. Replace legacy Vortex, Sphere, and Grid modes with three tactile, physically interactive worlds:
   - **Tape** (flagship continuous ribbons with wave propagation, grab-and-release physics, and transient pulses).
   - **Gravity** (coherent orbital particle streams with local attractor/repulsor forces and expanding transient shockwaves).
   - **Terrain** (continuous procedural scrolling height-field with seamless coordinate recycling and lateral steering).
2. Decouple audio analysis into a dedicated Web Worker (`src/workers/audioAnalysisWorker.ts`) using 2048-point Radix-2 FFT, Hann windowing, 32 logarithmic bands, and adaptive spectral flux transient detection.
3. Decouple simulation clock from media clock: animate using elapsed delta times with analytical damped harmonic springs, ensuring identical physical motion across 60Hz and 120Hz display refresh rates.
4. Establish explicit UI hit testing boundaries using `data-visualizer-ignore` and Pointer Events with capture and clean cancellation.
5. Create single `VisualizerRuntime` host owning one WebGLRenderer and animation loop across all mode switches.
6. Add comprehensive unit test suite covering motion time-invariance, stereo signal preservation, and transient onset detection.

## Done when
Visualizer runs Tape by default, switches seamlessly between Tape, Gravity, and Terrain with zero memory leaks, reacts to music via worker timeline, responds to touch/drag with spring physics, and passes all automated tests.
