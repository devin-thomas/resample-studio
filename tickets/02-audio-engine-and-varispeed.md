# T-02 Audio Engine & Exact Varispeed Pipeline

Status: completed
Depends on: T-01

## Work
Implement audio loader and playback engine supporting MP3, WAV, AAC, and M4A. Implement dual-path playback (HTMLAudioElement for live output + AudioContext AnalyserNode for visualization). Implement mathematical link between pitch cents (-1200 to +1200) and playbackRate ($2^{\text{cents}/1200}$). Ensure iOS background audio survival and MediaSession metadata.

## Done when
Loading an audio file plays with exact pitch/speed shifts across all supported formats.

## Verification
Load MP3 and M4A audio files; verify +1200 cents runs at 2.0x speed, -1200 cents runs at 0.5x speed.
