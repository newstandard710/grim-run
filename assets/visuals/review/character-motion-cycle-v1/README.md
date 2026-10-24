# Character motion cycle review v1

These are opt-in sprite cycles available at `?art=review-v2`. The approved default art, collision geometry, and gameplay remain unchanged.

## Reaper run

Four poses cycle at 10 fps: contact, airborne, recovery, and the previously approved run pose. New frames use the same 1792 × 1536 transparent canvas, 120px gameplay scale, cyan-eye registration, and `(1250, 1420)` scene anchor. The common eye position keeps the head from jumping sideways; the authored leg pose supplies the run lift.

## Cavern Bat flight

Eight timed positions cycle at 12 fps: raised, mid-up, neutral, mid-down, lowered, mid-down, neutral, mid-up. All use the 2304 × 1280 transparent canvas, the existing 52px scale, and the approved neutral pose's eye registration. The established dive state is unchanged.

## Review artwork

The dark/light sheets show each set at gameplay scale. Original generated transparent PNGs are retained in `reaper-source/` and `bat-source/`; `manifest.json` records source and normalized bounds. The runtime PNGs remain separate from these source files.

This build is for phone review. Promote the cycles to default only after the run rhythm, wing timing, size, and edge quality pass gameplay review.
