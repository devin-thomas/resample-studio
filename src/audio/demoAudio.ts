import { Track } from '../types/audio';

/**
 * Generates an in-memory energetic synthesizer groove track so the user can
 * test pitch/speed manipulation and visualizer immediately without needing
 * to find an audio file first.
 */
export function createDemoTrack(): Track {
  const sampleRate = 44100;
  const durationSeconds = 12;
  const totalSamples = sampleRate * durationSeconds;

  // Create WAV PCM buffer in memory
  const buffer = new ArrayBuffer(44 + totalSamples * 2 * 2); // 16-bit stereo
  const view = new DataView(buffer);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 4, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 2, true); // NumChannels (2 = stereo)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 4, true); // ByteRate
  view.setUint16(32, 4, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 4, true);

  // Synthesize a funky electronic groove (chords + bassline + hi-hat rhythm)
  let offset = 44;
  const bpm = 124;
  const beatsPerSecond = bpm / 60;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beat = t * beatsPerSecond;

    // Bassline (Funky 16th note acid bass)
    const bassNote = [55, 55, 65.4, 73.4, 55, 82.4, 73.4, 65.4][Math.floor(beat * 2) % 8];
    const bassEnv = Math.exp(-((beat * 2) % 1) * 4);
    const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.45 * bassEnv;

    // Synth Arpeggio (Cyan vibe chord notes)
    const arpFreqs = [220, 277.18, 329.63, 440, 554.37, 659.25];
    const arpFreq = arpFreqs[Math.floor(beat * 4) % arpFreqs.length];
    const arpEnv = Math.exp(-((beat * 4) % 1) * 6);
    const arp = Math.sin(2 * Math.PI * arpFreq * t) * 0.25 * arpEnv;

    // Kick & Hat rhythm
    const kickEnv = Math.exp(-((beat % 1)) * 14);
    const kick = Math.sin(2 * Math.PI * (120 * kickEnv + 45) * t) * 0.5 * kickEnv;
    const noise = (Math.random() * 2 - 1) * (beat % 0.5 < 0.1 ? 0.15 : 0.02);

    let left = bass + arp * 0.8 + kick + noise;
    let right = bass + arp * 1.1 + kick - noise;

    // Soft clip
    left = Math.max(-1, Math.min(1, left));
    right = Math.max(-1, Math.min(1, right));

    view.setInt16(offset, left < 0 ? left * 0x8000 : left * 0x7fff, true);
    view.setInt16(offset + 2, right < 0 ? right * 0x8000 : right * 0x7fff, true);
    offset += 4;
  }

  function writeString(v: DataView, off: number, str: string) {
    for (let j = 0; j < str.length; j++) {
      v.setUint8(off + j, str.charCodeAt(j));
    }
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const file = new File([blob], 'demo-cyber-groove.wav', { type: 'audio/wav' });
  const objectUrl = URL.createObjectURL(blob);

  return {
    id: 'demo-track-1',
    name: 'demo-cyber-groove.wav',
    size: buffer.byteLength,
    duration: durationSeconds,
    file,
    objectUrl,
    pitchCents: 0,
    speedPercent: 100.0,
    isLocked: false,
    selectedForExport: true,
  };
}
