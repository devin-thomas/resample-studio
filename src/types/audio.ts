export interface Track {
  id: string;
  name: string;
  size: number;
  duration: number;
  file: File;
  objectUrl: string;
  pitchCents: number;
  speedPercent: number;
  isLocked: boolean; // whether this track has locked settings
  selectedForExport: boolean; // whether this track is included in selective mix export
}

export type KnobsLinkMode = 'pitch' | 'speed' | 'unlinked';
export type RangeCapMode = 'basic' | 'advanced';

export interface KnobSettings {
  pitchCents: number;      // -1200 to +1200
  speedPercent: number;    // 25.0 to 400.0
  centsStep: number;       // 1 to 12
  linkMode: KnobsLinkMode; // 'pitch' | 'speed' | 'unlinked'
  capMode: RangeCapMode;   // 'basic' | 'advanced'
  basicCap: number;        // e.g. 1200, 600, 300, 100
  advancedMinCents: number;// -1200 to 0
  advancedMaxCents: number;// 0 to 1200
  advancedMinSpeed: number;// 25.0 to 100.0
  advancedMaxSpeed: number;// 100.0 to 400.0
}

export type RepeatMode = 'all' | 'one' | 'none';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeTrackId: string | null;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isChillMode: boolean;
}
