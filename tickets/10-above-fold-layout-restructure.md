# T-10 Above-the-Fold Layout Restructure

Status: open
Depends on: T-09
References: ADR 5, ADR 6

## Work
1. Restructure main grid layout so upload dropzone/file card and knobs are visible without scrolling on MacBook (1440×900) and iPhone (375×812 through 430×932).
2. Desktop (lg+): Left column has upload/file card at top, KnobControlPanel below. Right column has Playlist queue. Visualizer removed from grid (now background).
3. Mobile: Upload dropzone at top of Deck & Knobs tab, KnobControlPanel immediately below, sized to fit above fold.
4. Reduce excess padding/margins pushing content below fold.

## Done when
On MacBook (1440px height) and iPhone 14 (844px height), upload button and both knobs are fully visible without scrolling.

## Verification
Open on 1440×900 viewport — upload and knobs visible. Open on iPhone simulator — same. Upload a file — knobs remain visible.
