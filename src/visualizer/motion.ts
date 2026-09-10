/**
 * Time-based motion and physical damping utilities.
 * All units are in seconds, ensuring identical behavior across 60Hz and 120Hz display rates.
 */

/**
 * Exponential smooth follower toward target.
 */
export function smoothFollow(
  current: number,
  target: number,
  responseRate: number,
  dt: number
): number {
  const alpha = 1 - Math.exp(-Math.max(0, responseRate) * dt);
  return current + (target - current) * alpha;
}

/**
 * Exponential velocity decay.
 */
export function decayVelocity(velocity: number, dragRate: number, dt: number): number {
  return velocity * Math.exp(-Math.max(0, dragRate) * dt);
}

/**
 * Analytic second-order damped harmonic spring.
 * Unconditionally stable for any dt, with realistic physical overshoot and settling.
 */
export class DampedSpring {
  public position: number;
  public velocity: number;
  public target: number;
  public frequency: number; // Natural angular frequency (rad/s), e.g. 8-16
  public dampingRatio: number; // 0..1 = underdamped (bouncy), 1 = critical, >1 = overdamped

  constructor(initial = 0, frequency = 12, dampingRatio = 0.75) {
    this.position = initial;
    this.velocity = 0;
    this.target = initial;
    this.frequency = frequency;
    this.dampingRatio = dampingRatio;
  }

  public reset(val = 0): void {
    this.position = val;
    this.velocity = 0;
    this.target = val;
  }

  public update(dt: number): number {
    if (dt <= 0) return this.position;
    // Displace relative to target
    const x0 = this.position - this.target;
    const v0 = this.velocity;
    const omega0 = this.frequency;
    const zeta = this.dampingRatio;

    if (zeta < 1.0) {
      // Underdamped
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * omega0 * dt);
      const cosVal = Math.cos(omegaD * dt);
      const sinVal = Math.sin(omegaD * dt);

      const c1 = x0;
      const c2 = (v0 + zeta * omega0 * x0) / omegaD;

      this.position = this.target + decay * (c1 * cosVal + c2 * sinVal);
      this.velocity =
        decay *
        ((c2 * omegaD - c1 * zeta * omega0) * cosVal -
          (c1 * omegaD + c2 * zeta * omega0) * sinVal);
    } else if (Math.abs(zeta - 1.0) < 1e-4) {
      // Critically damped
      const decay = Math.exp(-omega0 * dt);
      const c1 = x0;
      const c2 = v0 + omega0 * x0;

      this.position = this.target + decay * (c1 + c2 * dt);
      this.velocity = decay * (c2 - omega0 * (c1 + c2 * dt));
    } else {
      // Overdamped
      const r = Math.sqrt(zeta * zeta - 1);
      const s1 = -omega0 * (zeta - r);
      const s2 = -omega0 * (zeta + r);

      const c2 = (v0 - s1 * x0) / (s2 - s1);
      const c1 = x0 - c2;

      this.position = this.target + c1 * Math.exp(s1 * dt) + c2 * Math.exp(s2 * dt);
      this.velocity = c1 * s1 * Math.exp(s1 * dt) + c2 * s2 * Math.exp(s2 * dt);
    }

    return this.position;
  }
}

/**
 * Clamps simulation delta time to avoid large jumps while remaining responsive.
 */
export function clampDeltaTime(rawDtSeconds: number, maxDtSeconds = 0.05): number {
  if (isNaN(rawDtSeconds) || rawDtSeconds <= 0) return 1 / 60;
  return Math.min(rawDtSeconds, maxDtSeconds);
}
