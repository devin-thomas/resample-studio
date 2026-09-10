# T-04 Multi-Track Playlist & Parameter Locks

Status: completed
Depends on: T-03

## Work
Build multi-track playlist supporting drag-and-drop file addition, track selection, reordering, and previous/next track transport buttons. Implement track settings state:
- Global mode: Knobs modify global playback state.
- Per-track lock toggle: When locked, adjusting knobs stores pitch/speed specifically for that track. Switching tracks smoothly restores that track's custom settings.

## Done when
Multiple tracks can be uploaded and played in sequence. Locked tracks remember their custom pitch/speed when switched.

## Verification
Upload 3 tracks; set track 1 to +300 cents (locked), track 2 to -400 cents (locked), track 3 unlocked; switch between them and verify settings update accurately.
