import {
  AudioFeatures,
  TimelineFrame,
  VisualTransient,
  WorkerAnalysisResponse,
} from './types';

function follow(
  target: number,
  current: number,
  dt: number,
  attackSeconds: number,
  releaseSeconds: number
): number {
  const tau = target > current ? attackSeconds : releaseSeconds;
  const alpha = 1 - Math.exp(-dt / Math.max(tau, 0.001));
  return current + (target - current) * alpha;
}

const MAX_FRAME_EVENTS = 16;
const NUM_LOG_BANDS = 32;

export class AudioFeatureTimeline {
  private worker: Worker | null = null;
  private currentGeneration = 0;

  // Stored timeline frames sorted by time
  private timeline: TimelineFrame[] = [];
  private allTransients: VisualTransient[] = [];

  // Reusable AudioFeatures structure
  private bandsArray = new Float32Array(NUM_LOG_BANDS);
  private eventsBuffer: VisualTransient[] = [];
  private audioFeatures: AudioFeatures;

  // Envelopes state
  private envBass = 0;
  private envMids = 0;
  private envHighs = 0;
  private envLoudness = 0;
  private envBrightness = 0;
  private envBands = new Float32Array(NUM_LOG_BANDS);
  private transientEnvelope = 0;

  private epoch = 0;
  private lastMediaTime = 0;
  private isSeekingOrJump = false;

  constructor() {
    for (let i = 0; i < MAX_FRAME_EVENTS; i++) {
      this.eventsBuffer.push({
        ordinal: 0,
        mediaTime: 0,
        strength: 0,
        kind: 'broadband',
      });
    }

    this.audioFeatures = {
      trackKey: null,
      epoch: 0,
      state: 'idle',
      mediaTime: 0,
      playing: false,
      playbackRate: 1.0,
      loudness: 0,
      bass: 0,
      mids: 0,
      highs: 0,
      brightness: 0,
      bands: this.bandsArray,
      transientEnvelope: 0,
      events: this.eventsBuffer,
      eventCount: 0,
    };

    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;
    try {
      this.worker = new Worker(
        new URL('../workers/audioAnalysisWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = (e: MessageEvent<WorkerAnalysisResponse>) => {
        const msg = e.data;
        if (!msg || msg.generation !== this.currentGeneration) return;

        if (msg.type === 'chunk') {
          if (msg.frames.length > 0) {
            this.timeline.push(...msg.frames);
          }
          if (msg.transients.length > 0) {
            this.allTransients.push(...msg.transients);
          }
          if (this.audioFeatures.state === 'loading') {
            this.audioFeatures.state = 'ready';
          }
        } else if (msg.type === 'error') {
          console.warn('Audio analysis worker error (ambient fallback active):', msg.error);
          this.audioFeatures.state = 'unavailable';
        }
      };
    } catch (e) {
      console.warn('Could not initialize audio analysis worker:', e);
      this.audioFeatures.state = 'unavailable';
    }
  }

  public analyzeBuffer(trackKey: string, buffer: AudioBuffer) {
    this.currentGeneration++;
    this.timeline = [];
    this.allTransients = [];
    this.epoch++;
    this.lastMediaTime = 0;
    this.isSeekingOrJump = true;

    this.audioFeatures.trackKey = trackKey;
    this.audioFeatures.epoch = this.epoch;
    this.audioFeatures.state = 'loading';

    if (!this.worker) {
      this.audioFeatures.state = 'unavailable';
      return;
    }

    // Extract channel data
    const channels: Float32Array[] = [];
    const numChannels = Math.min(2, buffer.numberOfChannels);
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    this.worker.postMessage({
      type: 'analyze',
      trackKey,
      generation: this.currentGeneration,
      sampleRate: buffer.sampleRate,
      channelData: channels,
    });
  }

  public resetTrack() {
    this.currentGeneration++;
    this.timeline = [];
    this.allTransients = [];
    this.epoch++;
    this.lastMediaTime = 0;
    this.isSeekingOrJump = true;

    this.audioFeatures.trackKey = null;
    this.audioFeatures.epoch = this.epoch;
    this.audioFeatures.state = 'idle';
  }

  public notifySeek(newMediaTime: number) {
    this.epoch++;
    this.audioFeatures.epoch = this.epoch;
    this.lastMediaTime = newMediaTime;
    this.isSeekingOrJump = true;
  }

  public notifyLoop() {
    this.epoch++;
    this.audioFeatures.epoch = this.epoch;
    this.lastMediaTime = 0;
    this.isSeekingOrJump = true;
  }

  public sample(mediaTime: number, isPlaying: boolean, playbackRate: number, dt: number): AudioFeatures {
    this.audioFeatures.mediaTime = mediaTime;
    this.audioFeatures.playing = isPlaying;
    this.audioFeatures.playbackRate = playbackRate;

    // Detect seek or backwards time jump
    if (Math.abs(mediaTime - this.lastMediaTime) > 0.4 || mediaTime < this.lastMediaTime) {
      this.isSeekingOrJump = true;
      this.epoch++;
      this.audioFeatures.epoch = this.epoch;
    }

    let rawLoudness = 0;
    let rawBass = 0;
    let rawMids = 0;
    let rawHighs = 0;
    let rawBrightness = 0;
    let targetBands: Float32Array | null = null;

    if (isPlaying && this.timeline.length > 0) {
      // Find nearest frame or interpolate
      const frame = this.getInterpolatedFrame(mediaTime);
      if (frame) {
        rawLoudness = frame.loudness;
        rawBass = frame.bass;
        rawMids = frame.mids;
        rawHighs = frame.highs;
        rawBrightness = frame.brightness;
        targetBands = frame.bands;
      }
    }

    // Apply attack/release followers
    this.envBass = follow(rawBass, this.envBass, dt, 0.03, 0.35);
    this.envMids = follow(rawMids, this.envMids, dt, 0.05, 0.24);
    this.envHighs = follow(rawHighs, this.envHighs, dt, 0.015, 0.14);
    this.envLoudness = follow(rawLoudness, this.envLoudness, dt, 0.10, 0.70);
    this.envBrightness = follow(rawBrightness, this.envBrightness, dt, 0.05, 0.20);

    for (let b = 0; b < NUM_LOG_BANDS; b++) {
      const tb = targetBands ? targetBands[b] : 0;
      this.envBands[b] = follow(tb, this.envBands[b], dt, 0.025, 0.18);
      this.bandsArray[b] = this.envBands[b];
    }

    // Process transient events crossed between lastMediaTime and mediaTime
    let eventCount = 0;
    if (isPlaying && !this.isSeekingOrJump && mediaTime >= this.lastMediaTime) {
      const tStart = this.lastMediaTime;
      const tEnd = mediaTime;

      for (let i = 0; i < this.allTransients.length; i++) {
        const tr = this.allTransients[i];
        if (tr.mediaTime > tStart && tr.mediaTime <= tEnd) {
          if (eventCount < MAX_FRAME_EVENTS) {
            const buf = this.eventsBuffer[eventCount];
            buf.ordinal = tr.ordinal;
            buf.mediaTime = tr.mediaTime;
            buf.strength = tr.strength;
            buf.kind = tr.kind;
            eventCount++;
          }
          this.transientEnvelope = Math.max(this.transientEnvelope, tr.strength);
        }
        if (tr.mediaTime > tEnd) {
          break; // Since transients are ordered by mediaTime
        }
      }
    }

    // Decay continuous transient envelope
    this.transientEnvelope *= Math.exp(-dt / 0.16);

    this.audioFeatures.loudness = this.envLoudness;
    this.audioFeatures.bass = this.envBass;
    this.audioFeatures.mids = this.envMids;
    this.audioFeatures.highs = this.envHighs;
    this.audioFeatures.brightness = this.envBrightness;
    this.audioFeatures.transientEnvelope = this.transientEnvelope;
    this.audioFeatures.eventCount = eventCount;

    this.lastMediaTime = mediaTime;
    this.isSeekingOrJump = false;

    return this.audioFeatures;
  }

  private getInterpolatedFrame(t: number): TimelineFrame | null {
    const len = this.timeline.length;
    if (len === 0) return null;
    if (t <= this.timeline[0].time) return this.timeline[0];
    if (t >= this.timeline[len - 1].time) return this.timeline[len - 1];

    // Binary search
    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const midTime = this.timeline[mid].time;
      if (midTime === t) return this.timeline[mid];
      if (midTime < t) low = mid + 1;
      else high = mid - 1;
    }

    const idx0 = Math.max(0, high);
    const idx1 = Math.min(len - 1, low);
    const f0 = this.timeline[idx0];
    const f1 = this.timeline[idx1];

    const span = f1.time - f0.time;
    if (span <= 1e-5) return f0;
    const factor = Math.max(0, Math.min(1, (t - f0.time) / span));

    // Linear interpolation
    const interpolatedBands = new Float32Array(NUM_LOG_BANDS);
    for (let b = 0; b < NUM_LOG_BANDS; b++) {
      interpolatedBands[b] = f0.bands[b] + (f1.bands[b] - f0.bands[b]) * factor;
    }

    return {
      time: t,
      loudness: f0.loudness + (f1.loudness - f0.loudness) * factor,
      bass: f0.bass + (f1.bass - f0.bass) * factor,
      mids: f0.mids + (f1.mids - f0.mids) * factor,
      highs: f0.highs + (f1.highs - f0.highs) * factor,
      brightness: f0.brightness + (f1.brightness - f0.brightness) * factor,
      bands: interpolatedBands,
    };
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const audioFeatureTimeline = new AudioFeatureTimeline();
