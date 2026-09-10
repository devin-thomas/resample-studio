import { Track } from '../types/audio';

export type AudioEventCallback = () => void;

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private isContextInitialized = false;

  private onTimeUpdateCbs: Set<(currentTime: number, duration: number) => void> = new Set();
  private onTrackEndedCbs: Set<() => void> = new Set();
  private onPlayStateChangeCbs: Set<(isPlaying: boolean) => void> = new Set();

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.disablePitchPreservation();

    this.audioElement.addEventListener('timeupdate', () => {
      const cur = this.audioElement.currentTime;
      const dur = this.audioElement.duration || 0;
      this.onTimeUpdateCbs.forEach((cb) => cb(cur, dur));
    });

    this.audioElement.addEventListener('ended', () => {
      this.onTrackEndedCbs.forEach((cb) => cb());
    });

    this.audioElement.addEventListener('play', () => {
      this.onPlayStateChangeCbs.forEach((cb) => cb(true));
      this.updateMediaSessionPlaybackState('playing');
    });

    this.audioElement.addEventListener('pause', () => {
      this.onPlayStateChangeCbs.forEach((cb) => cb(false));
      this.updateMediaSessionPlaybackState('paused');
    });
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

  public initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect HTMLAudioElement -> SourceNode -> GainNode -> AnalyserNode -> Destination
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioCtx.destination);
      } catch (err) {
        console.warn('MediaElementSource already connected or error:', err);
      }
      this.isContextInitialized = true;
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    if (!this.isContextInitialized) {
      this.initContext();
    }
    return this.analyserNode;
  }

  public loadTrack(track: Track, autoPlay = false) {
    this.disablePitchPreservation();
    if (this.audioElement.src !== track.objectUrl) {
      this.audioElement.src = track.objectUrl;
    }
    
    // Apply track specific rate
    this.setPlaybackRateFromCents(track.pitchCents);

    this.setupMediaSession(track);

    if (autoPlay) {
      this.play();
    }
  }

  public async play() {
    this.initContext();
    this.disablePitchPreservation();
    try {
      await this.audioElement.play();
    } catch (e) {
      console.warn('Audio play prevented (user gesture needed):', e);
    }
  }

  public pause() {
    this.audioElement.pause();
  }

  public seek(timeSeconds: number) {
    if (!isNaN(timeSeconds) && isFinite(timeSeconds)) {
      this.audioElement.currentTime = Math.max(0, Math.min(timeSeconds, this.audioElement.duration || 0));
    }
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.audioElement.volume = clamped;
  }

  public setPlaybackRate(rate: number) {
    // Varispeed requires preservesPitch = false
    this.disablePitchPreservation();
    const clamped = Math.max(0.25, Math.min(4.0, rate));
    this.audioElement.playbackRate = clamped;
  }

  public setPlaybackRateFromCents(cents: number) {
    // Rate = 2 ^ (cents / 1200)
    const rate = Math.pow(2, cents / 1200);
    this.setPlaybackRate(rate);
  }

  public getFrequencyData(outArray: Uint8Array<ArrayBuffer>): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(outArray);
    } else {
      outArray.fill(0);
    }
  }

  public getWaveformData(outArray: Uint8Array<ArrayBuffer>): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(outArray);
    } else {
      outArray.fill(128);
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

  // iOS MediaSession integration
  private setupMediaSession(track: Track) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name.replace(/\.[^/.]+$/, ''),
        artist: 'Resample Studio',
        album: 'Varispeed Lab',
        artwork: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="%2307090e"/><circle cx="256" cy="256" r="180" fill="none" stroke="%2300f0ff" stroke-width="24"/></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    }
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused') {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }
}

export const audioEngine = new AudioEngine();
