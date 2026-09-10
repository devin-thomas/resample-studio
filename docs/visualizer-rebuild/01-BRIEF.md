---
id: resample-visualizer-rebuild-brief
kind: implementation-brief
version: 0.1.0
status: proposed-implementation-direction
prepared: "2026-09-09"
project: Resample Studio
baseline_commit: d4f6323c4388899fe98b8d29eaece08e47816180
scope: visualization-and-analysis-only
---

# Resample Studio — Visualizer Rebuild

## What we are building

Replace Vortex / Sphere / Grid with **Gravity / Tape / Terrain**: three distinct, tactile visual worlds whose motion is shaped by the music rather than shaken by individual samples.

**Tape is the proposed flagship and first implementation.** Prove the audio response and interaction against one excellent mode before making three mediocre ones. Complete all three for the final replacement, but keep intermediate changes reversible.

These documents turn the preceding design discussion into an implementation proposal. The owner's reported experience establishes the problem; repository inspection establishes the code observations below. Names, numerical tuning values, interfaces, and the build sequence are proposed design decisions—not claims about existing functionality or measured performance.

## Read order and ownership

| Document | Owns |
|---|---|
| [02 — Art direction](02-ART-DIRECTION.md) | What each mode looks like, how it moves, how it responds, and what must be rejected |
| [03 — Audio contract](03-AUDIO-CONTRACT.md) | Decoded-file analysis, feature semantics, timing, smoothing, events, and failure behavior |
| [04 — Runtime and interaction](04-RUNTIME-AND-INTERACTION.md) | Module interfaces, pointer ownership, physical response, lifecycle, and performance |
| [05 — Delivery and acceptance](05-DELIVERY-AND-ACCEPTANCE.md) | Ordered tickets, test cases, release evidence, and implementation handoff |

Place this directory at `docs/visualizer-rebuild/` in the project. Read the existing `docs/VISUALIZATIONS.md`, `DECISIONS.md`, `SPEC.md`, and any current repository instructions before editing. Preserve their integration boundaries; explicitly reconcile superseded visualization details rather than maintaining two contradictory specifications.

## The experience we want

> A musical environment with momentum, not an equalizer glued to a mesh. Music changes the forces, flow, and energy of a coherent scene. Touch disturbs that scene. Letting go leaves a visible, damped response.

Every mode needs all three of these qualities:

- **Idle:** beautiful, continuous movement without pretending that audio is playing.
- **Playback:** stronger, legible musical gestures without destroying the idle composition.
- **Interaction:** a local, causal response to the user's hand, not merely a whole-scene tilt.

High refresh rate is useful but does not fix bad motion. Smoothly rendering random jitter at 120 callbacks per second is still a failure.

## Evidence behind the rebuild

Baseline reviewed: `d4f6323c4388899fe98b8d29eaece08e47816180`. Recheck changed files before implementation. These are static-source findings and design inferences, not a new physical-device test.

| Observation in the baseline | Consequence / interpretation |
|---|---|
| Vortex assigns `rotation.y = time * 0.15 + midAvg * 0.5`. | Changing mid energy directly changes the absolute angle. This can jump backward and forward instead of accelerating a rotation. |
| Particle positions and sphere deformation are mapped directly to instantaneous frequency/waveform values. | This is consistent with the owner's report that music introduces buzzing or jitter. Temporal smoothing and spatial coherence are not established by these mappings. |
| Grid rotates rings and sets their Z position from bass; its branch has no autonomous terrain progression. | Its idle immobility follows from the implementation. It is not an independently animated landscape. |
| Pointer handlers are on the background container; UI is layered above it. Only `mousemove`, `touchmove`, and `mouseleave` are handled. | UI hit-testing can prevent background input. Touch release/cancellation has no equivalent lifecycle in this handler. |
| Rotation increments, interpolation, and damping include per-frame constants. | Response changes with callback frequency. They must be expressed in elapsed time. |
| `getFrequencyData()` performs a 128-point nested-loop DFT, using every second sample, on the render path. | It is not the frequency model implied by the guide's "128 low-to-high bins" description. Correct analysis must precede artistic tuning. |
| Mode is an effect dependency, so switching reconstructs the renderer and scene. Ring geometries/materials are not explicitly disposed in the shown cleanup. | Replace mode-dependent renderer construction with one owned runtime and explicit resource cleanup. Verify actual resource behavior rather than assuming a measured leak rate. |
| Asynchronous decode writes `currentBuffer` without a generation check in the inspected implementation. | A slow previous decode can win a track-change race. Guard analysis ownership independently of playback. |

Sources: [visualizer component](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/src/components/AudioVisualizer.tsx), [audio engine](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/src/audio/engine.ts), [visualization guide](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/docs/VISUALIZATIONS.md), and [application layering / Chill Mode](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/src/App.tsx).

## Non-negotiable preservation boundaries

1. **Keep the full-viewport background.** No bordered visualizer widget, new layout column, or regression to controls below the fold. Preserve mode-pill placement and footer clearance.
2. **Preserve native audio playback.** Do not reconnect the audible media element through `createMediaElementSource()` to obtain analysis. The project intentionally separated output from visualization after background-audio problems. Keep that project boundary; do not repeat the older document's universal guarantees about all Safari behavior. [Existing ADRs 6–8](https://github.com/devin-thomas/resample-studio/blob/d4f6323c4388899fe98b8d29eaece08e47816180/DECISIONS.md).
3. **Do not modify audio semantics.** Preserve pitch/speed behavior, locks, repeat/shuffle, queue handling, export, and MediaSession controls. The analyzer reads actual playback state; it never becomes transport authority.
4. **Keep processing local.** No audio uploads, remote analysis service, microphone permission, account, or backend.
5. **Respect the working UI.** Knob drags, scrolling, sliders, file upload, playlist controls, modals, and Chill Mode exit must retain input ownership.
6. **Use the current visual family.** Deep `#07090e`, controlled cyan/indigo accents and occasional warm highlights, readable white text. Do not restyle the whole application.
7. **Do not promise a display rate.** Target 120 FPS on capable/permitted devices while preserving motion at 60. The owner reported that the Safari feature flag resolved the previous ceiling; that is a device observation, not a universal browser capability guarantee.

## Scope and anti-scope

**In scope:** replace the three modes, introduce useful audio features, repair the pointer lifecycle, make motion time-based, isolate modules, measure rendering, and update visualization documentation.

**Not in scope:** a visualization editor, preset marketplace, automatic genre classification, stem separation, perfect beat tracking, a general physics engine, a WebGPU migration, a framework rewrite, a new audio engine, or a new deployment provider.

Use one worker and small ordinary modules before inventing a plugin architecture. Keep one renderer and one active world. Add a dependency only when it replaces meaningful low-level work, such as a tested FFT implementation, and explain the bundle/licensing tradeoff in the implementation notes.

## Design rules that replace "reacts to audio"

- Large motion is slow and coherent; small detail may be fast.
- Energy may change velocity, tension, field strength, or an envelope. Do not add unsmoothed energy to an absolute angle.
- A transient creates a bounded event with a beginning, travel, and decay—not a repeated flash on every frame.
- Bass, mids, and highs have different jobs. Loudness must not inflate every object simultaneously.
- Silence and pause return to deliberate idle behavior. Failed analysis returns to idle, not invented beats.
- Input response should be visible where the hand acted and should survive release briefly.
- No mode qualifies by changing the visibility of another mode's objects.

## Definition of success

The user can listen, touch the scene, release, and immediately understand the relationship between music, hand, and motion. All three worlds remain recognizable in silence and during a loud, busy track. The controls stay usable. Playback keeps working when the visualizer pauses, fails, switches modes, or loses its graphics context.

Implementation completion and artistic acceptance are separate. A compiling shader and a high FPS number do not close the visual-quality ticket. Use the evidence checklist in document 05.
