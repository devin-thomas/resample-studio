import { Track } from '../types/audio';
import { centsToPlaybackRate } from './resampleMath';
import { encodeAudioBufferToMp3 } from '../workers/mp3Worker';

export interface ConcatenateOptions {
  tracks: Track[];
  useTrackSettings: boolean;
  masterPitchCents: number;
  kbps: number;
  onStatusUpdate: (status: string, percent: number) => void;
}

export async function concatenateAndExportMp3({
  tracks,
  useTrackSettings,
  masterPitchCents,
  kbps,
  onStatusUpdate,
}: ConcatenateOptions): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks selected for export');
  }

  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtxClass();

  try {
    // 1. Decode all selected tracks
    const decodedBuffers: { buffer: AudioBuffer; rate: number }[] = [];
    let totalRenderSamples = 0;
    const sampleRate = 44100; // Standard CD/MP3 sample rate

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      onStatusUpdate(
        `Decoding track ${i + 1} of ${tracks.length}: ${track.name}`,
        Math.round(((i + 0.1) / tracks.length) * 30)
      );

      const arrayBuffer = await track.file.arrayBuffer();
      // Decode audio data safely
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

      // Determine pitch shift rate
      const cents =
        useTrackSettings && track.isLocked
          ? track.pitchCents
          : masterPitchCents;
      const rate = centsToPlaybackRate(cents);

      // Calculate output samples at standard sample rate
      const resampledLength = Math.ceil(
        (audioBuffer.length * (sampleRate / audioBuffer.sampleRate)) / rate
      );
      totalRenderSamples += resampledLength;

      decodedBuffers.push({ buffer: audioBuffer, rate });
    }

    if (totalRenderSamples === 0) {
      throw new Error('Total render length is 0 samples');
    }

    // 2. Setup OfflineAudioContext
    onStatusUpdate('Preparing offline mix session...', 35);
    const offlineCtx = new OfflineAudioContext(2, totalRenderSamples, sampleRate);

    let currentStartTime = 0;
    for (let i = 0; i < decodedBuffers.length; i++) {
      const { buffer, rate } = decodedBuffers[i];
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(offlineCtx.destination);
      source.start(currentStartTime);

      const trackDuration = buffer.duration / rate;
      currentStartTime += trackDuration;
    }

    // 3. Start Offline Audio Rendering
    onStatusUpdate('Rendering composite varispeed mix...', 50);
    const renderedBuffer = await offlineCtx.startRendering();

    // 4. Encode to MP3 (<=320kbps)
    onStatusUpdate(`Encoding to ${kbps}kbps MP3...`, 65);
    const leftChannel = renderedBuffer.getChannelData(0);
    const rightChannel =
      renderedBuffer.numberOfChannels > 1
        ? renderedBuffer.getChannelData(1)
        : leftChannel;

    const mp3Blob = encodeAudioBufferToMp3(
      leftChannel,
      rightChannel,
      sampleRate,
      kbps,
      (encodeProgress) => {
        const overall = 65 + Math.round((encodeProgress / 100) * 34);
        onStatusUpdate(`Encoding MP3: ${encodeProgress}%`, overall);
      }
    );

    onStatusUpdate('Export complete!', 100);
    return mp3Blob;
  } finally {
    tempCtx.close().catch(() => {});
  }
}
