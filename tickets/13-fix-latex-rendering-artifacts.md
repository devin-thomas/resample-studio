# T-13 Fix Raw LaTeX Rendering Artifacts

Status: open
Depends on: none

## Work
1. In `App.tsx`, replace `$\le 320$ KBPS MP3` with `≤ 320 KBPS MP3`.
2. In `ExportModal.tsx`, replace `High-Fidelity $\le 320$kbps MP3 Concatenation` with `High-Fidelity ≤ 320kbps MP3 Concatenation`.

## Done when
No raw `$\le` text appears anywhere in the rendered UI.

## Verification
Open app — Selective Mix Export card shows `≤ 320 KBPS MP3`. Open Export Modal — shows `≤ 320kbps`.
