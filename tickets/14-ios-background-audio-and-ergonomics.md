# T-14 iOS Background Audio, White Typography Contrast & Ergonomics Overhaul

Status: completed
Depends on: T-09, T-10, T-11, T-12, T-13
References: ADR 1, ADR 8

## Work
1. **iOS Background Audio**: Route `HTMLAudioElement` directly to hardware output instead of through `AudioContext.createMediaElementSource().connect(destination)`. Append `<audio id="resample-media-player">` with `playsinline` and `webkit-playsinline` to DOM. Implement asynchronous `AudioBuffer` decoding on track load for real-time waveform and discrete FFT frequency spectrum computation.
2. **MediaSession Integration**: Add high-resolution 512x512 vinyl artwork generator, live `setPositionState` synchronizer, and handlers for `play`, `pause`, `previoustrack` (restart at 0:00), and `seekto`.
3. **Contrast & Typography**: Replace low-contrast cyan/blue fonts across the app with crisp, bold, high-contrast white text (`text-white`, `text-slate-100`) on dark backgrounds.
4. **Ergonomic Layout**:
   - Make Pitch and Speed dual knobs sit side-by-side (`grid-cols-2`) on mobile and desktop so both knobs are visible simultaneously above the fold.
   - Restructure step increment and fine slider to eliminate horizontal overflow on mobile devices.
   - Redesign bottom transport bar to be compact on mobile (~64px) so it never obscures the controls deck.
   - Cleanly align mode toggles and reset button.
5. **Playwright Visual Verification**: Install Playwright and capture screenshots across mobile (iPhone 14) and desktop (1440x900) viewports to verify zero overflow.

## Done when
Music continues playing when leaving Safari or locking the phone. Both knobs are visible side-by-side above the fold. All text has crisp white contrast with zero horizontal overflow on mobile.

## Verification
- `pnpm build` completes with zero TypeScript errors.
- Playwright mobile viewport check reports `scrollWidth === clientWidth === 390` (zero overflow).
- Visual verification via Playwright screenshots confirms high-contrast white typography and compact layout.
