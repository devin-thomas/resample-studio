import type * as THREE from 'three';

export type ModeId = 'tape' | 'gravity' | 'terrain';
export type FeatureState = 'idle' | 'loading' | 'ready' | 'unavailable';
export type ResetReason = 'track' | 'seek' | 'loop' | 'resume' | 'context-restored';
export type QualityTier = 'low' | 'balanced' | 'high';

export interface VisualTransient {
  ordinal: number;          // Unique within the current track's event timeline
  mediaTime: number;        // Source seconds
  strength: number;         // 0..1
  kind: 'low-band' | 'broadband'; // Heuristic, not a drum classifier
}

export interface AudioFeatures {
  trackKey: string | null;
  epoch: number;            // Changes on timeline discontinuity
  state: FeatureState;
  mediaTime: number;        // Current source seconds, not rate-multiplied again
  playing: boolean;
  playbackRate: number;     // Actual effective media playback rate
  loudness: number;         // 0..1 smoothed RMS-derived visual energy, not LUFS
  bass: number;             // 0..1 normalized and envelope-shaped
  mids: number;
  highs: number;
  brightness: number;       // 0..1 bounded source spectral-brightness proxy
  bands: Float32Array;      // 32 reusable normalized/enveloped source bands
  transientEnvelope: number; // Continuous decaying control
  events: readonly VisualTransient[]; // Reused fixed-capacity storage
  eventCount: number;       // Only [0, eventCount) is valid this render frame
}

export interface InteractionFrame {
  kind: 'none' | 'mouse' | 'touch' | 'pen';
  active: boolean;
  pressed: boolean;
  x: number;               // Canvas-local normalized coordinates, -1..1
  y: number;               // -1..1; positive is up
  velocityX: number;       // Normalized coordinate units per second
  velocityY: number;
  justPressed: boolean;
  justReleased: boolean;
  cancelled: boolean;
}

export interface Viewport {
  width: number;            // CSS pixels
  height: number;
  pixelRatio: number;       // Effective render scale, not assumed device DPR
}

export interface VisualizationFrame {
  simTime: number;          // Active simulation seconds; excludes hidden backlog
  dt: number;              // Bounded elapsed seconds
  audio: AudioFeatures;
  input: InteractionFrame;
  reducedMotion: boolean;
  presentation: 'studio' | 'chill';
}

export interface ModeContext {
  root: THREE.Group;       // Added/removed by runtime; child resources owned by mode
  camera: THREE.PerspectiveCamera;
  viewport: Viewport;
  quality: QualityTier;
}

export interface StudioVisualization {
  readonly id: ModeId;
  init(context: ModeContext): void;
  update(frame: VisualizationFrame): void;
  resize(viewport: Viewport): void;
  setQuality(quality: QualityTier): void; // May rebuild owned geometry safely
  setVisible(visible: boolean): void;
  reset(reason: ResetReason): void;
  dispose(): void;
}

export interface TimelineFrame {
  time: number;            // window center in seconds
  loudness: number;        // 0..1
  bass: number;            // 0..1
  mids: number;            // 0..1
  highs: number;           // 0..1
  brightness: number;      // 0..1
  bands: Float32Array;     // 32 log bands
}

export interface WorkerAnalysisRequest {
  type: 'analyze';
  trackKey: string;
  generation: number;
  sampleRate: number;
  channelData: Float32Array[];
}

export interface WorkerAnalysisChunkResponse {
  type: 'chunk';
  trackKey: string;
  generation: number;
  frames: TimelineFrame[];
  transients: VisualTransient[];
  isComplete: boolean;
}

export interface WorkerErrorResponse {
  type: 'error';
  trackKey: string;
  generation: number;
  error: string;
}

export type WorkerAnalysisResponse = WorkerAnalysisChunkResponse | WorkerErrorResponse;
