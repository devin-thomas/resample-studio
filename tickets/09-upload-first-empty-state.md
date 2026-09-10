# T-09 Upload-First Empty State & Progressive Disclosure

Status: open
Depends on: none
References: ADR 5

## Work
1. Remove the auto-load demo `useEffect` from `App.tsx` that calls `createDemoTrack()` on mount.
2. Create an `EmptyState` component with a prominent dashed-border upload dropzone featuring upload cloud icon, "Choose your audio files" primary text, file type guidance, and "Local-first" badge.
3. Implement progressive disclosure: when `tracks.length === 0`, show `EmptyState` prominently. Hide or disable KnobControlPanel and TransportBar.
4. When first file is uploaded, `EmptyState` collapses and full studio UI activates.
5. Keep "Load Demo" button in header as secondary fallback.

## Done when
App loads to a clean empty state with prominent upload dropzone. No audio plays automatically. Uploading a file transitions to full studio experience.

## Verification
Open fresh — no audio plays, no demo track. Upload a file — knobs and transport activate. Click "Load Demo" — demo still works manually.
