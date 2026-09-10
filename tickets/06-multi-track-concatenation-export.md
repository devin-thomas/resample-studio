# T-06 Selective Multi-Track Concatenation & MP3 Export

Status: completed
Depends on: T-04

## Work
Implement selective track export modal:
- Checkbox list of playlist tracks (select all, single track, or arbitrary subset like 1, 3, 5).
- Option to export with individual per-track locked settings or global master settings.
- Render tracks into a continuous composite `AudioBuffer` using `OfflineAudioContext`.
- Encode rendered audio into 320kbps MP3 via `lamejs` in a Web Worker to keep the UI responsive.
- Trigger download of the completed mix with progress bar.

## Done when
User can select tracks 1 and 3, export, and download a single cohesive MP3 file with applied varispeed.

## Verification
Export a 2-track mix; play exported MP3; verify file headers, 320kbps bitrate, and pitch consistency.
