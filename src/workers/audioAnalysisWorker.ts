import {
  TimelineFrame,
  VisualTransient,
  WorkerAnalysisRequest,
  WorkerAnalysisResponse,
} from '../visualizer/types';

const FFT_SIZE = 2048;
const HOP_SIZE = 512;
const NUM_LOG_BANDS = 32;

// Precompute Hann window
const HANN_WINDOW = new Float32Array(FFT_SIZE);
for (let n = 0; n < FFT_SIZE; n++) {
  HANN_WINDOW[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)));
}

// Precompute bit reversal permutation for N = 2048
const BIT_REVERSE = new Uint16Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  let reversed = 0;
  let temp = i;
  for (let b = 0; b < 11; b++) {
    // 2^11 = 2048
    reversed = (reversed << 1) | (temp & 1);
    temp >>= 1;
  }
  BIT_REVERSE[i] = reversed;
}

// Precompute twiddle factors
const SIN_TABLE = new Float32Array(FFT_SIZE / 2);
const COS_TABLE = new Float32Array(FFT_SIZE / 2);
for (let i = 0; i < FFT_SIZE / 2; i++) {
  const angle = (-2 * Math.PI * i) / FFT_SIZE;
  COS_TABLE[i] = Math.cos(angle);
  SIN_TABLE[i] = Math.sin(angle);
}

// Reusable buffers for FFT execution
const realBuffer = new Float32Array(FFT_SIZE);
const imagBuffer = new Float32Array(FFT_SIZE);
const magSpectrum = new Float32Array(FFT_SIZE / 2);
const prevSpectrum = new Float32Array(FFT_SIZE / 2);

function runFFT(input: Float32Array): void {
  // Apply Hann window and bit-reversal
  for (let i = 0; i < FFT_SIZE; i++) {
    const rev = BIT_REVERSE[i];
    realBuffer[rev] = input[i] * HANN_WINDOW[i];
    imagBuffer[rev] = 0;
  }

  // Cooley-Tukey Radix-2
  for (let len = 2; len <= FFT_SIZE; len <<= 1) {
    const half = len >> 1;
    const step = FFT_SIZE / len;
    for (let i = 0; i < FFT_SIZE; i += len) {
      for (let j = 0; j < half; j++) {
        const tableIdx = j * step;
        const cos = COS_TABLE[tableIdx];
        const sin = SIN_TABLE[tableIdx];
        const uReal = realBuffer[i + j];
        const uImag = imagBuffer[i + j];
        const vReal = realBuffer[i + j + half] * cos - imagBuffer[i + j + half] * sin;
        const vImag = realBuffer[i + j + half] * sin + imagBuffer[i + j + half] * cos;

        realBuffer[i + j] = uReal + vReal;
        imagBuffer[i + j] = uImag + vImag;
        realBuffer[i + j + half] = uReal - vReal;
        imagBuffer[i + j + half] = uImag - vImag;
      }
    }
  }

  // Compute magnitude for positive frequencies (k = 0 to N/2 - 1)
  const norm = 2.0 / FFT_SIZE;
  for (let k = 0; k < FFT_SIZE / 2; k++) {
    const r = realBuffer[k];
    const im = imagBuffer[k];
    magSpectrum[k] = Math.sqrt(r * r + im * im) * norm;
  }
}

let activeGeneration = -1;

self.onmessage = (e: MessageEvent<WorkerAnalysisRequest>) => {
  const req = e.data;
  if (!req || req.type !== 'analyze') return;

  activeGeneration = req.generation;
  const { trackKey, generation, sampleRate, channelData } = req;

  try {
    const numChannels = channelData.length;
    if (numChannels === 0 || channelData[0].length === 0) {
      const resp: WorkerAnalysisResponse = {
        type: 'chunk',
        trackKey,
        generation,
        frames: [],
        transients: [],
        isComplete: true,
      };
      self.postMessage(resp);
      return;
    }

    const totalSamples = channelData[0].length;
    const c0 = channelData[0];
    const c1 = numChannels > 1 ? channelData[1] : null;

    // Logarithmic band frequency boundaries
    const nyquist = sampleRate / 2;
    const minFreq = 30;
    const maxFreq = Math.min(16000, nyquist * 0.95);
    const binHz = sampleRate / FFT_SIZE;

    const logBandBinRanges: Array<{ startBin: number; endBin: number }> = [];
    for (let b = 0; b < NUM_LOG_BANDS; b++) {
      const fStart = minFreq * Math.pow(maxFreq / minFreq, b / NUM_LOG_BANDS);
      const fEnd = minFreq * Math.pow(maxFreq / minFreq, (b + 1) / NUM_LOG_BANDS);
      const startBin = Math.max(1, Math.floor(fStart / binHz));
      const endBin = Math.min(Math.floor(FFT_SIZE / 2) - 1, Math.max(startBin, Math.ceil(fEnd / binHz)));
      logBandBinRanges.push({ startBin, endBin });
    }

    // Broad bands
    const bassStart = Math.max(1, Math.floor(30 / binHz));
    const bassEnd = Math.min(Math.floor(FFT_SIZE / 2) - 1, Math.floor(250 / binHz));
    const midStart = bassEnd + 1;
    const midEnd = Math.min(Math.floor(FFT_SIZE / 2) - 1, Math.floor(2000 / binHz));
    const highStart = midEnd + 1;
    const highEnd = Math.min(Math.floor(FFT_SIZE / 2) - 1, Math.floor(16000 / binHz));

    prevSpectrum.fill(0);
    let transientOrdinal = 0;
    let lastTransientFrame = -999;
    const minRefractoryFrames = Math.max(4, Math.floor(0.09 / (HOP_SIZE / sampleRate))); // ~90ms

    // Flux history for adaptive thresholding
    const fluxHistory: number[] = [];
    const FLUX_HIST_LEN = 30;

    const frames: TimelineFrame[] = [];
    const transients: VisualTransient[] = [];

    const inputSlice = new Float32Array(FFT_SIZE);
    let frameIndex = 0;

    for (let offset = 0; offset + FFT_SIZE <= totalSamples; offset += HOP_SIZE) {
      if (activeGeneration !== generation) {
        return; // Abandoned by newer request
      }

      // Mix channels using stereo power preserving phase
      let sumSq = 0;
      if (c1) {
        for (let i = 0; i < FFT_SIZE; i++) {
          const l = c0[offset + i];
          const r = c1[offset + i];
          // Balanced stereo sample with sign retention from dominant channel
          const p = 0.5 * (l * l + r * r);
          sumSq += p;
          // Time-domain signal for FFT: sign of dominant channel * sqrt(power)
          const sign = Math.abs(l) >= Math.abs(r) ? Math.sign(l) || 1 : Math.sign(r) || 1;
          inputSlice[i] = sign * Math.sqrt(p);
        }
      } else {
        for (let i = 0; i < FFT_SIZE; i++) {
          const s = c0[offset + i];
          sumSq += s * s;
          inputSlice[i] = s;
        }
      }

      const rms = Math.sqrt(sumSq / FFT_SIZE);
      const loudness = Math.min(1.0, rms * 3.2);

      // Perform FFT
      runFFT(inputSlice);

      // Broad bands calculation
      let bassSum = 0;
      for (let k = bassStart; k <= bassEnd; k++) bassSum += magSpectrum[k];
      const bassVal = Math.min(1.0, (bassSum / Math.max(1, bassEnd - bassStart + 1)) * 4.5);

      let midSum = 0;
      for (let k = midStart; k <= midEnd; k++) midSum += magSpectrum[k];
      const midVal = Math.min(1.0, (midSum / Math.max(1, midEnd - midStart + 1)) * 6.5);

      let highSum = 0;
      for (let k = highStart; k <= highEnd; k++) highSum += magSpectrum[k];
      const highVal = Math.min(1.0, (highSum / Math.max(1, highEnd - highStart + 1)) * 12.0);

      // Spectral centroid (brightness)
      let num = 0;
      let denom = 0;
      for (let k = 1; k < FFT_SIZE / 2; k++) {
        const mag = magSpectrum[k];
        num += k * binHz * mag;
        denom += mag;
      }
      const centroid = denom > 1e-6 ? num / denom : 0;
      const brightness = Math.max(0, Math.min(1, (centroid - 200) / 7000));

      // 32 Logarithmic Bands
      const logBands = new Float32Array(NUM_LOG_BANDS);
      for (let b = 0; b < NUM_LOG_BANDS; b++) {
        const range = logBandBinRanges[b];
        let bSum = 0;
        for (let k = range.startBin; k <= range.endBin; k++) {
          bSum += magSpectrum[k];
        }
        const bAvg = bSum / Math.max(1, range.endBin - range.startBin + 1);
        // Mild progressive high-frequency boost for perceptual equal loudness
        const boost = 1.0 + (b / NUM_LOG_BANDS) * 2.0;
        logBands[b] = Math.max(0, Math.min(1, Math.sqrt(bAvg * boost) * 2.8));
      }

      // Spectral flux (positive differences only)
      let flux = 0;
      let lowFlux = 0;
      for (let k = 1; k < FFT_SIZE / 2; k++) {
        const diff = magSpectrum[k] - prevSpectrum[k];
        if (diff > 0) {
          flux += diff;
          if (k <= bassEnd) lowFlux += diff;
        }
        prevSpectrum[k] = magSpectrum[k];
      }

      // Adaptive threshold for transients based on prior history
      let fluxMean = 0;
      if (fluxHistory.length > 0) {
        for (let f = 0; f < fluxHistory.length; f++) fluxMean += fluxHistory[f];
        fluxMean /= fluxHistory.length;
      }

      const threshold = fluxMean * 1.65 + 0.015;
      const windowCenterTime = (offset + FFT_SIZE / 2) / sampleRate;

      if (
        flux > threshold &&
        flux > 0.04 &&
        frameIndex - lastTransientFrame >= minRefractoryFrames
      ) {
        lastTransientFrame = frameIndex;
        const strength = Math.min(1.0, (flux - threshold) / (fluxMean * 2.0 + 0.01) + 0.3);
        const kind = lowFlux / Math.max(0.0001, flux) > 0.45 ? 'low-band' : 'broadband';
        transients.push({
          ordinal: transientOrdinal++,
          mediaTime: windowCenterTime,
          strength,
          kind,
        });
      }

      // Update history for subsequent frames
      fluxHistory.push(flux);
      if (fluxHistory.length > FLUX_HIST_LEN) fluxHistory.shift();

      frames.push({
        time: windowCenterTime,
        loudness,
        bass: bassVal,
        mids: midVal,
        highs: highVal,
        brightness,
        bands: logBands,
      });

      frameIndex++;

      // Post progress in batches of 150 frames (~1.7 seconds)
      if (frames.length >= 150) {
        const chunk: WorkerAnalysisResponse = {
          type: 'chunk',
          trackKey,
          generation,
          frames: [...frames],
          transients: [...transients],
          isComplete: false,
        };
        self.postMessage(chunk);
        frames.length = 0;
        transients.length = 0;
      }
    }

    // Send final chunk
    const finalChunk: WorkerAnalysisResponse = {
      type: 'chunk',
      trackKey,
      generation,
      frames,
      transients,
      isComplete: true,
    };
    self.postMessage(finalChunk);
  } catch (err) {
    const errorResp: WorkerAnalysisResponse = {
      type: 'error',
      trackKey,
      generation,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorResp);
  }
};
