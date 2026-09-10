import { Track } from '../types/audio';
import { audioFeatureTimeline } from '../visualizer/audioFeatures';

export type AudioEventCallback = () => void;

/**
 * Generate 512x512 vinyl artwork for iOS Dynamic Island and Lock Screen
 */
function generateArtworkDataUri(title: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark studio gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#111318');
    grad.addColorStop(1, '#07090e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Vinyl grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 2;
    for (let r = 70; r < 230; r += 14) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer cyan accent ring
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(256, 256, 170, 0, Math.PI * 2);
    ctx.stroke();

    // Center hub
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(256, 256, 42, 0, Math.PI * 2);
    ctx.fill();

    // Spindle hole
    ctx.fillStyle = '#07090e';
    ctx.beginPath();
    ctx.arc(256, 256, 15, 0, Math.PI * 2);
    ctx.fill();

    // Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.textAlign = 'center';
    const displayTitle = title.length > 20 ? title.substring(0, 19) + '…' : title;
    ctx.fillText(displayTitle.toUpperCase(), 256, 420);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText('RESAMPLE STUDIO', 256, 455);

    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

class AudioEngine {
  private audioElement: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentTrack: Track | null = null;
  private currentCents = 0;
  private lastPositionSync = 0;
  private decodeGeneration = 0;

  private hasEndedFired = false;
  private isRestarting = false;
  private onTimeUpdateCbs: Set<(currentTime: number, duration: number) => void> = new Set();
  private onTrackEndedCbs: Set<() => void> = new Set();
  private onPlayStateChangeCbs: Set<(isPlaying: boolean) => void> = new Set();
  private onNextTrackHandler: (() => void) | null = null;
  private onPrevTrackHandler: (() => void) | null = null;

  constructor() {
    this.audioElement = document.createElement('audio');
    this.audioElement.id = 'resample-media-player';
    this.audioElement.preload = 'auto';
    this.audioElement.loop = false;
    this.audioElement.style.display = 'none';

    // Critical iOS Safari attributes for persistent background playback
    (this.audioElement as any).playsInline = true;
    (this.audioElement as any).webkitPlaysInline = true;
    this.audioElement.setAttribute('playsinline', 'true');
    this.audioElement.setAttribute('webkit-playsinline', 'true');

    this.disablePitchPreservation();

    this.audioElement.addEventListener('timeupdate', () => {
      const cur = this.audioElement.currentTime;
      const dur = this.audioElement.duration || 0;
      this.onTimeUpdateCbs.forEach((cb) => cb(cur, dur));
      this.syncPositionState();

      // Guard fallback: if playback reached the end and ended hasn't fired yet
      if (dur > 0 && cur >= dur - 0.05 && !this.audioElement.paused && !this.hasEndedFired && !this.isRestarting) {
        this.hasEndedFired = true;
        this.onTrackEndedCbs.forEach((cb) => cb());
      }
    });

    this.audioElement.addEventListener('ended', () => {
      if (this.hasEndedFired || this.isRestarting) return;
      this.hasEndedFired = true;
      this.onTrackEndedCbs.forEach((cb) => cb());
    });

    this.audioElement.addEventListener('play', () => {
      this.hasEndedFired = false;
      this.onPlayStateChangeCbs.forEach((cb) => cb(true));
      this.updateMediaSessionPlaybackState('playing');
      this.syncPositionState(true);
    });

    this.audioElement.addEventListener('pause', () => {
      this.onPlayStateChangeCbs.forEach((cb) => cb(false));
      this.updateMediaSessionPlaybackState('paused');
      this.syncPositionState(true);
    });

    this.audioElement.addEventListener('ratechange', () => {
      this.syncPositionState(true);
    });

    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.appendChild(this.audioElement);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(this.audioElement);
        });
      }
    }
  }

  private disablePitchPreservation() {
    const el = this.audioElement as HTMLAudioElement & {
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    el.preservesPitch = false;
    if ('mozPreservesPitch' in el) el.mozPreservesPitch = false;
    if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = false;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public async loadTrack(track: Track, autoPlay = false) {
    this.currentTrack = track;
    this.currentCents = track.pitchCents;
    this.hasEndedFired = false;
    this.isRestarting = false;
    this.audioElement.loop = false;
    this.disablePitchPreservation();

    audioFeatureTimeline.resetTrack();

    if (this.audioElement.src !== track.objectUrl) {
      this.audioElement.src = track.objectUrl;
    }
    this.audioElement.currentTime = 0;

    this.setPlaybackRateFromCents(track.pitchCents);
    this.setupMediaSession(track);

    // Asynchronously decode audio data for real-time visualization & analysis
    this.decodeTrackBuffer(track);

    if (autoPlay) {
      await this.play();
    }
  }

  private async decodeTrackBuffer(track: Track) {
    const decodeGen = ++this.decodeGeneration;
    try {
      let arrayBuf: ArrayBuffer;
      if (track.file) {
        arrayBuf = await track.file.arrayBuffer();
      } else {
        const resp = await fetch(track.objectUrl);
        arrayBuf = await resp.arrayBuffer();
      }

      const ctx = this.getAudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      if (decodeGen !== this.decodeGeneration) return;

      this.currentBuffer = decoded;
      audioFeatureTimeline.analyzeBuffer(track.id, decoded);
    } catch (e) {
      if (decodeGen !== this.decodeGeneration) return;
      console.warn('AudioBuffer decoding for visualizer failed (playback unaffected):', e);
      this.currentBuffer = null;
    }
  }

  public async play() {
    this.disablePitchPreservation();
    try {
      await this.audioElement.play();
    } catch (e) {
      console.warn('Playback play prevented (user interaction required):', e);
    }
  }

  public pause() {
    this.audioElement.pause();
  }

  public async restart() {
    this.isRestarting = true;
    this.hasEndedFired = false;
    this.audioElement.loop = false;
    audioFeatureTimeline.notifySeek(0);
    this.disablePitchPreservation();

    if (this.currentTrack) {
      this.setPlaybackRateFromCents(this.currentTrack.pitchCents);
    }

    // Helper: apply pitch settings and play
    const finishAndPlay = async () => {
      this.disablePitchPreservation();
      if (this.currentTrack) {
        this.setPlaybackRateFromCents(this.currentTrack.pitchCents);
      }
      this.isRestarting = false;
      try {
        await this.audioElement.play();
        this.syncPositionState(true);
      } catch (err) {
        console.warn('restart play() failed:', err);
      }
    };

    // Attempt 1: Direct seek + play (works on Chrome/Firefox/desktop Safari)
    try {
      this.audioElement.currentTime = 0;
      await this.audioElement.play();

      // Verify playback actually started — iOS Safari can silently resolve play()
      // but leave the element paused/ended after a blob URL finishes.
      await new Promise((r) => setTimeout(r, 50));
      if (this.audioElement.paused || this.audioElement.ended) {
        throw new Error('play() resolved but audio is not playing');
      }

      this.isRestarting = false;
      this.syncPositionState(true);
      return;
    } catch {
      // Simple path failed — fall through to src reload
      this.isRestarting = true;
    }

    // Attempt 2: Reload src to reset iOS Safari AVPlayer pipeline for blob URLs.
    // After 'ended', the blob data reference can be released, making the previous
    // src unusable. Re-assigning it forces a fresh decode pipeline.
    if (this.currentTrack) {
      const readyPromise = new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          this.audioElement.removeEventListener('canplay', done);
          resolve();
        };
        this.audioElement.addEventListener('canplay', done, { once: true });
        // Timeout: if canplay never fires (e.g. blob was revoked), proceed anyway
        setTimeout(done, 2000);
      });

      this.audioElement.src = this.currentTrack.objectUrl;
      this.audioElement.currentTime = 0;

      await readyPromise;
      await finishAndPlay();
    } else {
      this.isRestarting = false;
    }
  }

  public setLoop(_loop: boolean) {
    // Native loop is intentionally kept false to prevent iOS Safari blob stalls and guarantee ended events
    this.audioElement.loop = false;
  }

  public getLoop(): boolean {
    return false;
  }

  public seek(timeSeconds: number) {
    if (!isNaN(timeSeconds) && isFinite(timeSeconds)) {
      const dur = this.audioElement.duration || 0;
      this.audioElement.currentTime = Math.max(0, Math.min(timeSeconds, dur));
      audioFeatureTimeline.notifySeek(this.audioElement.currentTime);
      this.syncPositionState(true);
    }
  }

  public setVolume(val: number) {
    this.audioElement.volume = Math.max(0, Math.min(1, val));
  }

  public setPlaybackRate(rate: number) {
    this.disablePitchPreservation();
    const clamped = Math.max(0.25, Math.min(4.0, rate));
    this.audioElement.playbackRate = clamped;
  }

  public setPlaybackRateFromCents(cents: number) {
    this.currentCents = cents;
    const rate = Math.pow(2, cents / 1200);
    this.setPlaybackRate(rate);
    this.updateMediaSessionMetadata();
  }

  public getPlaybackRate(): number {
    return this.audioElement.playbackRate || 1.0;
  }

  /**
   * Extract real-time waveform data from the decoded PCM buffer at the current playback position.
   */
  public getWaveformData(outArray: Uint8Array<ArrayBuffer>): void {
    if (!this.currentBuffer || this.audioElement.paused) {
      outArray.fill(128);
      return;
    }

    const channelData = this.currentBuffer.getChannelData(0);
    const sampleRate = this.currentBuffer.sampleRate;
    const currentSample = Math.floor(this.audioElement.currentTime * sampleRate);
    const count = outArray.length;

    for (let i = 0; i < count; i++) {
      const idx = currentSample + i * 2;
      const sample = idx >= 0 && idx < channelData.length ? channelData[idx] : 0;
      // Map float [-1.0, 1.0] to unsigned byte [0, 255]
      outArray[i] = Math.max(0, Math.min(255, Math.floor((sample + 1) * 127.5)));
    }
  }

  /**
   * Compute real-time frequency data across 128 frequency bins at current playback position.
   */
  public getFrequencyData(outArray: Uint8Array<ArrayBuffer>): void {
    if (!this.currentBuffer || this.audioElement.paused) {
      outArray.fill(0);
      return;
    }

    const channelData = this.currentBuffer.getChannelData(0);
    const sampleRate = this.currentBuffer.sampleRate;
    const currentSample = Math.floor(this.audioElement.currentTime * sampleRate);
    const N = 128;

    // Fast discrete spectral energy calculation with Hann windowing
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      const step = 2;

      for (let n = 0; n < N; n++) {
        const idx = currentSample + n * step;
        const sample = idx >= 0 && idx < channelData.length ? channelData[idx] : 0;
        // Hann window
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        const windowedSample = sample * window;

        const angle = (2 * Math.PI * k * n) / N;
        real += windowedSample * Math.cos(angle);
        imag -= windowedSample * Math.sin(angle);
      }

      const mag = Math.sqrt(real * real + imag * imag);
      // Logarithmic / perceptual scaling to 0..255
      const scaled = Math.min(255, Math.floor(Math.sqrt(mag) * 85));
      outArray[k] = scaled;
    }
  }

  public getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.audioElement.duration || 0;
  }

  public isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  public onTimeUpdate(cb: (currentTime: number, duration: number) => void): () => void {
    this.onTimeUpdateCbs.add(cb);
    return () => this.onTimeUpdateCbs.delete(cb);
  }

  public onTrackEnded(cb: () => void): () => void {
    this.onTrackEndedCbs.add(cb);
    return () => this.onTrackEndedCbs.delete(cb);
  }

  public onPlayStateChange(cb: (isPlaying: boolean) => void): () => void {
    this.onPlayStateChangeCbs.add(cb);
    return () => this.onPlayStateChangeCbs.delete(cb);
  }

  public setMediaSessionActionHandlers(handlers: {
    onNext?: () => void;
    onPrev?: () => void;
  }) {
    if (handlers.onNext) this.onNextTrackHandler = handlers.onNext;
    if (handlers.onPrev) this.onPrevTrackHandler = handlers.onPrev;
    this.bindMediaSessionTrackHandlers();
  }

  private bindMediaSessionTrackHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if (this.onNextTrackHandler) {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          this.onNextTrackHandler?.();
        });
      }
      if (this.onPrevTrackHandler) {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          this.onPrevTrackHandler?.();
        });
      }
    } catch {}
  }

  // iOS MediaSession integration for Dynamic Island / Lock Screen
  private setupMediaSession(track: Track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    this.currentTrack = track;
    this.updateMediaSessionMetadata();

    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        this.seek(details.seekTime);
      }
    });

    this.bindMediaSessionTrackHandlers();
    this.syncPositionState(true);
  }

  private updateMediaSessionMetadata() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !this.currentTrack) {
      return;
    }

    const cleanTitle = this.currentTrack.name.replace(/\.[^/.]+$/, '');
    const pitchStr =
      this.currentCents >= 0 ? `+${this.currentCents}¢` : `${this.currentCents}¢`;
    const speedPct = `${(this.audioElement.playbackRate * 100).toFixed(1)}%`;
    const artworkUri = generateArtworkDataUri(cleanTitle);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: cleanTitle,
      artist: `${speedPct} speed • ${pitchStr}`,
      album: 'Resample Studio',
      artwork: artworkUri
        ? [
            {
              src: artworkUri,
              sizes: '512x512',
              type: 'image/png',
            },
          ]
        : [],
    });
  }

  private syncPositionState(force = false) {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !('setPositionState' in navigator.mediaSession)
    ) {
      return;
    }

    const now = performance.now();
    if (!force && now - this.lastPositionSync < 1000) {
      return;
    }
    this.lastPositionSync = now;

    try {
      const dur = this.audioElement.duration || 0;
      if (dur > 0 && !isNaN(dur)) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0.1, dur),
          playbackRate: Math.max(0.1, this.audioElement.playbackRate || 1.0),
          position: Math.max(0, Math.min(dur, this.audioElement.currentTime || 0)),
        });
      }
    } catch {
      // Ignored
    }
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }
}

export const audioEngine = new AudioEngine();

