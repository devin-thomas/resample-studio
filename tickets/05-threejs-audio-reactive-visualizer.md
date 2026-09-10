# T-05 120Hz Three.js Audio Reactive Visualizer

Status: completed
Depends on: T-02

## Work
Implement a full-canvas / player-integrated Three.js WebGL visual scene:
- Connect Web Audio `AnalyserNode` frequency bins and time-domain waveform data.
- Render dynamic 3D audio-reactive geometry (particle cloud, neon reactive ribbon, or pulsing crystalline sphere) reacting to bass hits and treble shimmer.
- Ensure 120Hz ProMotion support via unthrottled requestAnimationFrame with delta-time smoothing.
- Touch/mouse orbit or interactive tilt for delight.

## Done when
Canvas renders smooth, responsive 3D visuals that pulse and deform in sync with the audio.

## Verification
Play audio track; verify 120 FPS render loop without frame drops or audio stuttering.
