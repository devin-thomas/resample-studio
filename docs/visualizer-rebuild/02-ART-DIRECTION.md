---
id: resample-visualizer-art-direction
kind: creative-specification
version: 0.1.0
status: proposed-implementation-direction
prepared: "2026-09-09"
modes: [gravity, tape, terrain]
flagship: tape
---

# Three Visual Worlds

This is original art direction derived from the owner's complaints and the preceding design discussion. It specifies desired behavior, not existing implementation. Numerical ranges are tuning starting points and must be judged with real music and touch.

## Shared visual grammar

Keep a dark, spacious composition with recognizable depth. The scene fills the screen but does not fill every pixel with bright activity. Behind studio controls, place the strongest gestures in visible margins and allow glow through the glass panels. In Chill Mode, use the same world with a clearer composition—not a fourth visualization or an unrelated color theme.

**Avoid:** a white center obscuring text, full-screen flashes, camera shakes, random color changes per frame, featureless point clouds, razor-thin unreadable geometry, and a mesh that becomes uglier as the song gets louder.

Music mapping:

| Signal | Perceptual job | Avoid |
|---|---|---|
| Bass envelope | Weight, compression, broad bends, large waves | Twitching the whole object at raw sample rate |
| Mid envelope | Sustained flow, curvature, tension, twisting | Snapping absolute rotations back and forth |
| High envelope | Small edge activity, sparks, surface texture | Equally large movement everywhere |
| Detected transient | A discrete impulse that travels and dissipates | Claiming every onset is a correctly identified kick or beat |
| Overall energy | Gradual intensity and modest scale changes | Constant global pumping or brightness saturation |
| Playback speed | Subtle travel-rate change | Recomputing phase from `elapsedTime * changingSpeed` |

Every world has an independent base motion. Audio modulates that motion rather than replacing it. Reduced-motion behavior is the deliberate exception: use a stable scene and mild local responses, not continuous camera travel.

## 1. Tape — the signature mode

### One-sentence picture

**A few long luminous strips behave like suspended magnetic tape: they flow, bend under pressure, carry pulses, and settle with weight.**

This should feel tactile and connected to resampling without drawing a literal cassette or building a skeuomorphic tape machine.

### Composition and material

Use two or three continuous ribbons with actual width, surface shading, and bright but restrained edges. One is the main silhouette; others support depth. A diagonal or shallow S-curve should cross behind the UI with enough of the ribbon visible around the controls to understand its movement.

Depth comes from crossings, perspective, partial occlusion, and a slow twist exposing the strip's surface. Do not use 128 disconnected equalizer bars or a thin oscilloscope line and call it tape.

Start with modest tessellation and a continuous spline/frame or procedural strip. Handle tangent/frame continuity so the ribbon does not suddenly flip orientation. A convincing surface matters more than a large vertex count.

### Idle

A low-amplitude traveling bend passes along the strips. They drift in a coherent current while keeping their identities and overall composition. No hard reset at a period boundary. The viewer should be able to follow a crest traveling along one ribbon.

### Music

- **Bass:** broad, low-frequency bending and a modest tension/width response. Keep the overall silhouette intact.
- **Mids:** slow torsion and changes in curvature. Favor the material twisting over arbitrary object rotation.
- **Highs:** fine edge ripples or short localized gleams; a subordinate layer, not the main silhouette.
- **Transients:** inject one traveling disturbance or light pulse into the strip. It has a finite width and lifetime. Several can overlap within a fixed pool, but must not become flashing noise.
- **Speed:** change flow velocity gently, with smoothing and bounds. Faster playback must not produce a discontinuous position jump.

### Hand interaction

Mouse hover exerts a weak local attraction. Press near a visible ribbon to grab a section; drag pulls that section while nearby sections follow with falloff. Release transfers the bend into a damped traveling wave. A fast swipe creates a larger response than a slow pull, up to a safe cap.

Touch uses press/drag/release on the dedicated interaction surface. Do not require hover, pressure hardware, or pixel-perfect selection of a narrow strip. Use a generous screen-space grab radius and a reusable plane/curve projection. Touching far away may make a weak disturbance, but must not teleport the entire ribbon to the finger.

The ribbon must not remain stuck to the last touch after `pointerup`, cancellation, or opening a modal.

### A short behavior sequence

```text
0: idle S-curve flowing through depth
1: bass transient -> one broad bend begins
2: the bend travels along the tape and decays
3: finger pulls a nearby section out of its path
4: release -> overshoot -> one or two diminishing waves -> base flow
```

The sequence illustrates cause and effect; it is not a fixed timed loop to play independently of the music.

### Reject this mode when

It resembles a waveform stretched across a line, the whole strip changes size simultaneously, triangles chatter, the surface flips unpredictably, or release simply returns an interpolation target without visible propagation.

## 2. Gravity — a field you can disturb

### One-sentence picture

**A deep field of particles follows coherent orbital streams around a dark center; music and the user's hand disturb the field without destroying its flow.**

This is a stylized force field, not an astronomy simulation. No N-body calculation is needed.

### Composition and material

A few curved streams establish the direction of travel. Particles differ modestly in depth and size. Leave a calm central volume and occasional near-camera crossings for depth. Use restrained cyan/indigo energy with sparse warmer highlights. The system should read as a flowing field even with sound off.

Start near the existing particle-count scale, not tens of thousands. Use instancing/points and a batched field evaluation or low-dimensional control field; avoid one allocation or scene node per particle.

### Idle

Particles progress along stable streams. Each retains its path identity while the field slowly precesses. Do not redraw a different random cloud each frame. Baseline motion is directional, not an in-place vibration.

### Music

- **Bass:** collective compression followed by an outward wave or orbital widening. The effect changes a field parameter smoothly.
- **Mids:** increase circulation or bounded turbulence. Integrate angular velocity over time rather than assigning energy to angle.
- **Highs:** a small number of short sparks or extra brightness on selected streams.
- **Transients:** an expanding shell disturbs particles as it reaches them, so near and far particles react at different times.
- **Overall energy:** raises activity within a fixed range; dense music must still leave negative space.

### Hand interaction

The pointer projects into the scene as a softened local attractor or repulsor, not just camera parallax. Particles curve around the hand. Drag moves the force source; release leaves residual circulation that fades.

A flick contributes a bounded tangential impulse. Avoid singular forces, particles collapsing to one point, unbounded velocities, or the whole scene spinning until it is illegible. Hover is weaker than pressed interaction.

### A short behavior sequence

```text
orbital flow -> local attraction -> curved wake behind the hand
release -> wake keeps moving -> flow gradually recovers
bass transient -> expanding disturbance passes through multiple depths
```

### Reject this mode when

Particles only pulse radially at fixed original positions, all objects react at once, touching moves only the camera, or the system becomes a sparkling fog with no recognizable motion direction.

## 3. Terrain — a moving landscape with musical memory

### One-sentence picture

**A continuous dark landscape moves beneath a stable horizon, with broad musical ridges, smaller surface detail, and gentle steering.**

Build a real height-field surface or ribbon grid. Rotating the old circles onto their sides is not a replacement.

### Composition and material

A stable horizon, atmospheric fade, and readable rows provide depth. Use a finite bounded mesh with scrolling coordinates/history rather than an ever-growing world. The floor extends beyond portrait and landscape edges so screen rotation does not expose an empty rectangle.

Fine lines may accent the surface but must not alias into a bright moiré field on the phone. The terrain must be visible through its actual material; reactive lights do not help a material that ignores lighting.

### Idle

The world advances continuously at a gentle baseline speed, even without a track. Quiet rolling structure remains. Scrolling/recycling is seamless; a modulo reset must not teleport the landscape.

### Music

- **Bass:** wide hills or ridges, never a whole-plane Z jump.
- **Mids:** medium-scale undulations across the surface.
- **Highs:** small surface ripples and restrained highlights.
- **Transients:** a coherent ridge or traveling wave born at the event time. It moves across the visible terrain and decays.
- **Frequency history:** neighboring regions/rows may retain recent envelopes. This is a stylized history, not a calibrated spectrogram.
- **Speed:** smoothly modulates forward travel. Maintain continuity when the playback rate changes.

New reactions must start when the source event occurs, not before. A ridge arriving at the camera later is an intentional travel effect; do not confuse that with an analysis synchronization failure.

### Hand interaction

Dragging background steers lateral motion or leans the camera gently; a local push can displace the nearby surface. Release produces a damped return or brief inertial drift. Keep the horizon stable enough to avoid disorientation. No unrestricted roll, camera inversion, or camera collision with the surface.

### A short behavior sequence

```text
continuous travel -> bass creates broad ridge -> ridge travels and relaxes
horizontal drag -> gentle bank / lateral flow -> release -> damped recovery
```

### Reject this mode when

There is no independent movement in silence, the entire grid jumps toward the camera with bass, geometry snaps at recycling boundaries, or touching feels identical to Gravity or Tape.

## Interaction intensity and studio composition

Use one shared strength policy, not an exposed parameter dashboard. Suggested starting points: visible response begins immediately on the next render opportunities, release remains perceptible for roughly 0.3–0.9 seconds, and broader musical effects can decay for roughly 0.4–1.2 seconds. These are artistic tuning ranges, not hard timing promises.

Chill Mode is already an application presentation mode that hides most controls in the inspected `App.tsx`; it is **not** a synonym for reduced motion. Preserve its behavior. Normal studio mode prioritizes readable controls and vertical scrolling; Chill Mode provides the larger direct-manipulation area. [Source](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/src/App.tsx).

## Approval standard

Compare each mode with the same sparse percussion clip, sustained bass/pad clip, busy full mix, and silence. Record normal studio and Chill Mode, plus one touch-and-release. A still screenshot cannot prove that any of these motion requirements have been met.

Do not add another mode until Tape's musical response and release feel are convincing. Reuse the analysis and interaction infrastructure, not Tape's geometry, to build the other two.
