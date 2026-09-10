# T-12 Visualization Mouse/Touch Responsiveness & Momentum

Status: open
Depends on: T-11
References: ADR 7

## Work
1. Increase lerp smoothing factor from 0.05 to 0.12.
2. Increase rotation range from ±0.6/±0.4 to ±1.2/±0.8 radians.
3. Add momentum/inertia: track mouse velocity, apply residual velocity decaying at 0.96/frame when mouse stops or leaves.
4. Clamp maximum velocity to prevent disorienting spin.
5. Ensure touch interaction uses same momentum system.

## Done when
Mouse movement produces immediate visible rotation. Quick flicks cause coasting deceleration. Interaction feels physical and satisfying.

## Verification
Hover and move mouse — scene tracks responsively. Flick and release — momentum carries rotation. Test on touch device.
