/**
 * Mathematical calculations for Varispeed Pitch and Speed coupling.
 */

// Rate from Pitch Cents: Rate = 2 ^ (cents / 1200)
export function centsToPlaybackRate(cents: number): number {
  return Math.pow(2, cents / 1200);
}

// Pitch Cents from Rate: Cents = 1200 * log2(Rate)
export function playbackRateToCents(rate: number): number {
  if (rate <= 0) return -1200;
  return Math.round(1200 * Math.log2(rate));
}

// Rate to Speed Percentage: e.g. 1.0 -> 100.0%
export function rateToSpeedPercent(rate: number): number {
  return Number((rate * 100).toFixed(1));
}

// Speed Percentage to Rate: e.g. 100.0 -> 1.0
export function speedPercentToRate(speedPercent: number): number {
  return speedPercent / 100;
}

// Cents to Speed Percentage
export function centsToSpeedPercent(cents: number): number {
  return rateToSpeedPercent(centsToPlaybackRate(cents));
}

// Speed Percentage to Cents
export function speedPercentToCents(speedPercent: number): number {
  return playbackRateToCents(speedPercentToRate(speedPercent));
}

// Opposite Mode: Inverts the direction of shift
export function oppositeCentsToSpeedPercent(cents: number): number {
  const invertedRate = Math.pow(2, -cents / 1200);
  return Math.max(25.0, Math.min(400.0, Number((invertedRate * 100).toFixed(1))));
}

export function oppositeSpeedPercentToCents(speedPercent: number): number {
  const rate = speedPercent / 100;
  if (rate <= 0) return 0;
  const invertedCents = -Math.round(1200 * Math.log2(rate));
  return Math.max(-1200, Math.min(1200, invertedCents));
}

// Quantize cents according to chosen step (1 to 100)
export function quantizeCents(rawCents: number, step: number): number {
  const safeStep = Math.max(1, Math.min(100, Math.round(step)));
  return Math.round(rawCents / safeStep) * safeStep;
}

// Format seconds into MM:SS
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
