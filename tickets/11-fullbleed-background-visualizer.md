# T-11 Full-Bleed Background Visualizer

Status: open
Depends on: T-10
References: ADR 6

## Work
1. Remove AudioVisualizer from main grid layout.
2. Render Three.js canvas as `position: fixed; inset: 0; z-index: 0` full-viewport background.
3. Remove bordered container, aspect ratio constraints, and minimum height.
4. Add ambient idle mode: subtle slow animation when no audio plays.
5. Transition smoothly to full audio-reactive mode during playback.
6. Move mode selector pills and FPS counter to small floating pill overlay.
7. Remove fullscreen toggle (no longer needed).
8. Ensure UI panels have sufficient glassmorphism backdrop-blur for legibility.

## Done when
Three.js visualizer fills entire viewport as background. UI panels float above with glassmorphism. Mode selector is a small floating control.

## Verification
Open app — vortex covers full background. Play audio — reactivity works. All text and controls legible over visualization.
