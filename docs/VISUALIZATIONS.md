# Resample Studio - Visualization Technical Guide

This document is the authoritative technical reference for the audio visualization architecture in **Resample Studio**. It is designed for engineers and AI agents creating, modifying, or extending 3D visualizers within this codebase.

---

## 1. Architectural Overview

The visualizer in Resample Studio is **not** a constrained widget or video box. It is a **full-bleed, 120Hz audio-reactive 3D WebGL background layer** running directly behind the entire user interface ([ADR 6](file:///Users/neo/dev/resample-studio/DECISIONS.md#L60-L71)).

```
┌────────────────────────────────────────────────────────────────────────┐
│ Top UI Layer (z-40): Header & Floating Transport Bar                  │
├────────────────────────────────────────────────────────────────────────┤
│ Middle UI Layer (z-10): Glassmorphism Panels (Knobs, Playlist, Upload) │
├────────────────────────────────────────────────────────────────────────┤
│ Control Overlay (z-30): Floating Mode Selector & FPS Counter Pill      │
├────────────────────────────────────────────────────────────────────────┤
│ Background Canvas (z-0): Three.js WebGL Scene (fixed inset-0)          │
└────────────────────────────────────────────────────────────────────────┘
```

The UI cards sit on top using glassmorphism (`backdrop-blur-md`, `bg-studio-900/80`, `border-white/10`), letting the 3D particles and geometries glow through without sacrificing control contrast or text legibility.

---

## 2. End-to-End Data Flow

```
                     ┌───────────────────────────┐
                     │   <audio> HTML Element    │
                     │  (Direct Hardware Output) │
                     └─────────────┬─────────────┘
                                   │ Playback
                     ┌─────────────▼─────────────┐
                     │    Decoded AudioBuffer    │
                     │ (ctx.decodeAudioData PCM) │
                     └─────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
   audioEngine.getFrequencyData()            audioEngine.getWaveformData()
   • 128 FFT spectral bins (0..255)          • 128 PCM waveform samples (0..255)
   • Bass, Mid, Treble averages              • Time-domain instantaneous amplitude
              │                                         │
              └────────────────────┬────────────────────┘
                                   │
                                   ▼
              ┌─────────────────────────────────────────┐
              │       AudioVisualizer (Three.js)        │
              │  • requestAnimationFrame (up to 120Hz)   │
              │  • Pointer Parallax & Inertia Momentum  │
              │  • Vertex & Attribute Array Mutation    │
              │  • WebGLRenderer.render(scene, camera)  │
              └─────────────────────────────────────────┘
```

### Why Audio Routing is Decoupled ([ADR 8](file:///Users/neo/dev/resample-studio/DECISIONS.md#L84-L98))
On iOS Safari, routing audio through `AudioContext.createMediaElementSource()` into `ctx.destination` causes the operating system to suspend audio playback the moment the user locks the screen or switches tabs.

To ensure **unbroken background playback and Lock Screen / Dynamic Island integration**, the audio playback runs natively through an unrouted `<audio>` element. Spectral and waveform analysis is decoupled: when a track loads, its PCM data is decoded asynchronously into an in-memory `AudioBuffer`. The audio engine then calculates FFT frequency bins and waveform slices in real time based on `audioElement.currentTime`.

---

## 3. Data Contracts: Inputs & Outputs

### 3.1 Audio Inputs (`audioEngine`)

Audio metrics are polled on every animation tick from [`src/audio/engine.ts`](file:///Users/neo/dev/resample-studio/src/audio/engine.ts). Never instantiate new arrays inside the loop; reuse pre-allocated typed arrays:

```ts
const freqData = new Uint8Array(128);
const waveData = new Uint8Array(128);

// Inside the animation loop:
audioEngine.getFrequencyData(freqData);
audioEngine.getWaveformData(waveData);
```

#### Spectral Frequency Data (`freqData: Uint8Array(128)`)
- **Range**: `0` (silent) to `255` (maximum peak energy).
- **Index mapping**: 128 discrete frequency bins covering the audible spectrum linearly from sub-bass to treble shimmer.
- **Derived frequency bands**:
  ```ts
  // Bass (Bins 0 to 13): 0.0 to 1.0
  let bassSum = 0;
  for (let i = 0; i < 14; i++) bassSum += freqData[i];
  const bassAvg = bassSum / 14 / 255;

  // Mids (Bins 14 to 59): 0.0 to 1.0
  let midSum = 0;
  for (let i = 14; i < 60; i++) midSum += freqData[i];
  const midAvg = midSum / 46 / 255;

  // Treble (Bins 60 to 127): 0.0 to 1.0
  let trebleSum = 0;
  for (let i = 60; i < 128; i++) trebleSum += freqData[i];
  const trebleAvg = trebleSum / 68 / 255;
  ```

#### Time-Domain Waveform Data (`waveData: Uint8Array(128)`)
- **Range**: `0` to `255`, centered at `128`.
- **Normalization formula**:
  ```ts
  // Converts raw byte [0..255] to normalized float [-1.0 .. +1.0]
  const normalizedSample = (waveData[i] - 128) / 128;
  ```
- **Usage**: Displacing mesh vertices along normals or drawing oscilloscope line ribbons.

---

### 3.2 User Interaction & Physics Inputs ([ADR 7](file:///Users/neo/dev/resample-studio/DECISIONS.md#L72-L83))

Visualizations must support interactive tilt and rotation with physical momentum:
- **Normalized coordinates**:
  $$nx = \frac{\text{clientX} - \text{rect.left}}{\text{rect.width}} \times 2 - 1 \quad (\in [-1.0, 1.0])$$
  $$ny = -\left(\frac{\text{clientY} - \text{rect.top}}{\text{rect.height}} \times 2 - 1\right) \quad (\in [-1.0, 1.0])$$
- **Target rotation range**: $Y \in [-1.2, 1.2]$ radians, $X \in [-0.8, 0.8]$ radians.
- **Lerp smoothing factor**: `0.12` when pointer is active; `0.06` when drifting.
- **Momentum physics**:
  - Track pointer velocity: `(delta / frame) * 0.5`, clamped to `MAX_VELOCITY = 0.08`.
  - Velocity decay factor: `VELOCITY_DECAY = 0.96` per frame.

---

### 3.3 Visual Outputs

1. **WebGL Canvas Frame**: Rendered via `renderer.render(scene, camera)` directly to the DOM `<canvas>`.
2. **Telemetry**: Rolling frame rate computed over a 1000ms window (`fps` state) and surfaced in the overlay badge.

---

## 4. Three.js Domain Concepts in Resample Studio

For developers or agents unfamiliar with 3D/WebGL terminology:

| Component | Three.js Construct | Role in Resample Studio |
| :--- | :--- | :--- |
| **Scene** | `THREE.Scene` | The 3D world container. Configured with atmospheric exponential fog: `new THREE.FogExp2(0x07090e, 0.025)`. |
| **Camera** | `THREE.PerspectiveCamera` | 60° FOV, positioned at `(0, 0, 32)`. Looks at origin `(0, 0, 0)`. |
| **Geometry** | `THREE.BufferGeometry`, `THREE.IcosahedronGeometry` | Raw vertex positions `[x0, y0, z0, x1, y1, z1, ...]`. Manipulated in-place every frame for audio reactivity. |
| **Material** | `THREE.PointsMaterial`, `THREE.MeshStandardMaterial`, `THREE.LineBasicMaterial` | Shading rules. Studio visuals favor `AdditiveBlending`, cyan/orange/indigo palettes, and `wireframe: true`. |
| **Lighting** | `THREE.AmbientLight`, `THREE.PointLight` | Ambient dark studio fill (`#111622`) plus reactive cyan (`#00f0ff`) and orange (`#ff6b00`) point lights whose intensities scale with `bassAvg` and `trebleAvg`. |
| **Renderer** | `THREE.WebGLRenderer` | Created with `antialias: true`, `alpha: true`, `powerPreference: 'high-performance'`. Pixel ratio clamped to `Math.min(window.devicePixelRatio, 2)`. |

---

## 5. Current Visualizer Modes

Located in [`src/components/AudioVisualizer.tsx`](file:///Users/neo/dev/resample-studio/src/components/AudioVisualizer.tsx):

1. **`vortex`**:
   - 1,800 particle points (`THREE.Points`) distributed in a spherical shell.
   - Vertices pulse radially outward according to frequency bin energy and `bassAvg`.
   - The entire swarm rotates on the Y/Z axes with speed boosted by `midAvg`.
   - Encloses a pulsating central wireframe orb and 32 concentric tunnel rings.
2. **`sphere`**:
   - An icosahedron mesh (`detail: 3`).
   - Vertices are displaced along their original coordinate vectors based on real-time `waveData` PCM samples.
   - Mesh scale pulses with `bassAvg`.
3. **`grid`**:
   - Tunnel rings rotated 90° to form an infinite audio horizon grid.
   - Grid depth reacts to bass hits.

---

## 6. How to Build a New Visualization (Modular Pattern)

When adding or generating a new visualization mode, adhere to this modular interface:

```ts
import * as THREE from 'three';

export interface AudioFrameData {
  freqData: Uint8Array;
  waveData: Uint8Array;
  bassAvg: number;
  midAvg: number;
  trebleAvg: number;
  elapsedTime: number;
}

export interface StudioVisualization {
  readonly id: string;
  readonly name: string;

  /** Allocate geometries, materials, meshes, and add to scene */
  init(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;

  /** Audio-reactive update executed every frame (up to 120Hz) */
  update(frame: AudioFrameData): void;

  /** Set visibility when switching modes */
  setVisible(visible: boolean): void;

  /** Free WebGL GPU resources when component unmounts */
  dispose(scene: THREE.Scene): void;
}
```

### Complete Implementation Example: Audio-Reactive Neon Ribbons

```ts
export class NeonRibbonVisualization implements StudioVisualization {
  readonly id = 'ribbon';
  readonly name = 'Ribbon';

  private group = new THREE.Group();
  private lineGeometry!: THREE.BufferGeometry;
  private lineMaterial!: THREE.LineBasicMaterial;
  private lineMesh!: THREE.Line;
  private pointsCount = 128;

  init(scene: THREE.Scene) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < this.pointsCount; i++) {
      points.push(new THREE.Vector3((i - this.pointsCount / 2) * 0.25, 0, 0));
    }

    this.lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
    });

    this.lineMesh = new THREE.Line(this.lineGeometry, this.lineMaterial);
    this.group.add(this.lineMesh);
    scene.add(this.group);
  }

  update({ waveData, bassAvg, elapsedTime }: AudioFrameData) {
    const posAttr = this.lineGeometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < this.pointsCount; i++) {
      // Map 0..255 byte to -1.0 .. +1.0
      const amplitude = (waveData[i] - 128) / 128;
      // y-axis offset (index 1, 4, 7...)
      posArray[i * 3 + 1] = amplitude * (3.0 + bassAvg * 5.0);
    }
    posAttr.needsUpdate = true;

    this.group.rotation.y = elapsedTime * 0.2;
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
  }
}
```

---

## 7. Performance & Engineering Constraints

### Rule 1: Zero Allocations in the Animation Loop (120Hz Target)
**Never** invoke `new THREE.Vector3()`, `new THREE.Color()`, or allocate arrays inside `animate()`. Allocations inside a 120 FPS loop trigger V8 garbage collection pauses, producing audible audio glitches and dropped frames on Apple Silicon / ProMotion displays.

### Rule 2: Mandatory GPU Resource Disposal
WebGL objects are not garbage-collected by the JavaScript runtime. Any geometry, material, texture, or render target instantiated must be disposed explicitly in the cleanup hook:
```ts
geometry.dispose();
material.dispose();
renderer.dispose();
```

### Rule 3: Background Contrast Preservation
The canvas background clear color must be `#07090e` (`renderer.setClearColor(0x07090e, 1)`). Do not use bright white or high-opacity ambient lighting that washes out the glassmorphic control panels.

### Rule 4: Decouple Audio Output from WebGL
Never attempt to re-route `HTMLAudioElement` through an `AudioContext.createMediaElementSource()` for visualization purposes, as this breaks background playback on iOS Safari. Always use the buffer-based extraction provided by `audioEngine.getFrequencyData()`.
