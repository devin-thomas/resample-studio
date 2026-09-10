# T-03 Tactile Pitch & Speed Knobs

Status: completed
Depends on: T-02

## Work
Build custom tactile rotary knob components:
1. Pitch Knob: -1200 to +1200 cents. Step selector (1-100 cents). Basic range capping (symmetric hundreds) and Advanced arbitrary min/max limits.
2. Speed Knob: 25.0% to 400.0% (1-decimal precision).
3. Multiple interaction modalities: rotary drag with mouse/touch, scroll wheel over knob, and direct editable numeric badge.
4. Mode toggle: Linked Varispeed mode vs. Independent control.

## Done when
Knobs rotate smoothly with tactile feedback, respond to mouse drag, wheel scroll, and text typing, respecting step increments and capping limits.

## Verification
Drag knob from 0 to +600 cents; test mouse wheel; type "-350" directly; verify step increment works.
