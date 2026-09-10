import { Mp3Encoder } from '@breezystack/lamejs';

export interface Mp3EncodePayload {
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  sampleRate: number;
  kbps: number;
}

export function encodeAudioBufferToMp3(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: number,
  onProgress?: (progress: number) => void
): Blob {
  const numChannels = right && right.length > 0 ? 2 : 1;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const sampleBlockSize = 1152;
  const mp3Data: BlobPart[] = [];

  const length = left.length;
  // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
  const leftInt16 = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, left[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  let rightInt16: Int16Array | null = null;
  if (numChannels === 2) {
    rightInt16 = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, right[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  for (let i = 0; i < length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Int8Array | Uint8Array;
    if (numChannels === 2 && rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      // Create fresh Uint8Array copy backed by ArrayBuffer
      const copy = new Uint8Array(mp3buf.length);
      copy.set(mp3buf);
      mp3Data.push(copy);
    }

    if (onProgress && i % (sampleBlockSize * 10) === 0) {
      onProgress(Math.min(99, Math.round((i / length) * 100)));
    }
  }

  const mp3Flush = encoder.flush();
  if (mp3Flush.length > 0) {
    const flushCopy = new Uint8Array(mp3Flush.length);
    flushCopy.set(mp3Flush);
    mp3Data.push(flushCopy);
  }

  if (onProgress) {
    onProgress(100);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}
