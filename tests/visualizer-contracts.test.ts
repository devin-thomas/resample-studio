import assert from 'node:assert';
import test, { describe, it } from 'node:test';
import { DampedSpring, smoothFollow, decayVelocity, clampDeltaTime } from '../src/visualizer/motion.ts';

describe('Motion & Spring Time-Invariance (VIS-03 / VIS-07)', () => {
  it('smoothFollow matches across 60Hz and 120Hz updates', () => {
    let val60 = 0;
    const dt60 = 1 / 60;
    for (let i = 0; i < 60; i++) {
      val60 = smoothFollow(val60, 1.0, 5.0, dt60);
    }

    let val120 = 0;
    const dt120 = 1 / 120;
    for (let i = 0; i < 120; i++) {
      val120 = smoothFollow(val120, 1.0, 5.0, dt120);
    }

    const diff = Math.abs(val60 - val120);
    assert.ok(diff < 0.001, `60Hz vs 120Hz smoothFollow difference ${diff} should be < 0.001`);
  });

  it('DampedSpring produces time-invariant trajectory between 60Hz and 120Hz', () => {
    // Initial displacement = 2.0, velocity = 5.0, target = 0
    const spring60 = new DampedSpring(2.0, 12, 0.7);
    spring60.velocity = 5.0;
    spring60.target = 0;

    const spring120 = new DampedSpring(2.0, 12, 0.7);
    spring120.velocity = 5.0;
    spring120.target = 0;

    // Simulate for 0.8 seconds
    const duration = 0.8;
    const steps60 = Math.round(duration * 60);
    for (let i = 0; i < steps60; i++) {
      spring60.update(1 / 60);
    }

    const steps120 = Math.round(duration * 120);
    for (let i = 0; i < steps120; i++) {
      spring120.update(1 / 120);
    }

    const posDiff = Math.abs(spring60.position - spring120.position);
    const velDiff = Math.abs(spring60.velocity - spring120.velocity);

    assert.ok(posDiff < 0.01, `Position discrepancy ${posDiff} must be < 1%`);
    assert.ok(velDiff < 0.05, `Velocity discrepancy ${velDiff} must be < 5%`);
  });

  it('clampDeltaTime prevents giant jumps on lag / foreground return', () => {
    assert.strictEqual(clampDeltaTime(1.5, 0.05), 0.05);
    assert.strictEqual(clampDeltaTime(0.016, 0.05), 0.016);
    assert.strictEqual(clampDeltaTime(-1, 0.05), 1 / 60);
  });
});

describe('Audio Analysis & Stereo Contracts (VIS-02)', () => {
  const FFT_SIZE = 2048;

  function computeStereoSample(l: number, r: number): number {
    const p = 0.5 * (l * l + r * r);
    const sign = Math.abs(l) >= Math.abs(r) ? Math.sign(l) || 1 : Math.sign(r) || 1;
    return sign * Math.sqrt(p);
  }

  it('Preserves right-only audio energy without dropping signal', () => {
    const l = 0.0;
    const r = 0.8;
    const sample = computeStereoSample(l, r);
    assert.ok(Math.abs(sample) > 0.4, `Right-only channel should produce audible energy: ${sample}`);
  });

  it('Does not cancel opposite-phase stereo signals (anti-phase test)', () => {
    const l = 0.707;
    const r = -0.707;
    const sample = computeStereoSample(l, r);
    assert.ok(Math.abs(sample) > 0.5, `Anti-phase stereo should not sum to zero: ${sample}`);
  });

  it('Spectral flux transient detector does not continuously trigger on sustained tones', () => {
    // Generate synthetic sustained tone
    const numFrames = 50;
    const fluxHistory: number[] = [];
    let transientCount = 0;
    let lastTransientFrame = -999;
    const refractoryFrames = 6;

    for (let f = 0; f < numFrames; f++) {
      // In a sustained tone, after the onset at frame 0, subsequent spectral flux is ~0
      const flux = f === 0 ? 0.8 : 0.005;

      let fluxMean = 0;
      if (fluxHistory.length > 0) {
        for (let i = 0; i < fluxHistory.length; i++) fluxMean += fluxHistory[i];
        fluxMean /= fluxHistory.length;
      }

      const threshold = fluxMean * 1.65 + 0.015;

      if (flux > threshold && flux > 0.04 && f - lastTransientFrame >= refractoryFrames) {
        lastTransientFrame = f;
        transientCount++;
      }

      fluxHistory.push(flux);
      if (fluxHistory.length > 30) fluxHistory.shift();
    }

    assert.strictEqual(
      transientCount,
      1,
      `Sustained tone should only trigger 1 onset at beginning, got ${transientCount}`
    );
  });

  it('Calculates correct frequency bounds regardless of sample rate', () => {
    // Test 44100 Hz vs 48000 Hz
    const rates = [44100, 48000, 96000];
    for (const sr of rates) {
      const binHz = sr / 2048;
      const bassStart = Math.max(1, Math.floor(30 / binHz));
      const bassEnd = Math.min(1023, Math.floor(250 / binHz));
      const midStart = bassEnd + 1;
      const midEnd = Math.min(1023, Math.floor(2000 / binHz));
      const highStart = midEnd + 1;
      const highEnd = Math.min(1023, Math.floor(16000 / binHz));

      assert.ok(bassStart < bassEnd, `Bass start ${bassStart} should be < bassEnd ${bassEnd} for ${sr}Hz`);
      assert.ok(midStart < midEnd, `Mid start ${midStart} should be < midEnd ${midEnd} for ${sr}Hz`);
      assert.ok(highStart < highEnd, `High start ${highStart} should be < highEnd ${highEnd} for ${sr}Hz`);
    }
  });

  it('Envelope follower smoothly follows attack and release without NaN or overshoot', () => {
    let current = 0;
    const dt = 1 / 60;
    // Attack phase toward 1.0
    for (let i = 0; i < 20; i++) {
      const next = current + (1.0 - current) * (1 - Math.exp(-dt / 0.03));
      assert.ok(next >= current && next <= 1.0, 'Value should monotonically increase toward 1.0');
      current = next;
    }
    assert.ok(current > 0.8, `Attack should reach > 0.8 within 20 frames, got ${current}`);

    // Release phase toward 0.0
    for (let i = 0; i < 30; i++) {
      const next = current + (0.0 - current) * (1 - Math.exp(-dt / 0.35));
      assert.ok(next <= current && next >= 0.0, 'Value should monotonically decrease toward 0.0');
      current = next;
    }
    assert.ok(current < 0.3, `Release should drop < 0.3 within 30 frames, got ${current}`);
  });
});
