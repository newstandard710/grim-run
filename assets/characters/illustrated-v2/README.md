# Grim Run character art review v2

These PNGs are used only by `?art=review-v2`. They do not replace the default v0.10.4 sprites.

- Reaper: 10 transparent PNG poses on a 1792 × 1536 canvas, anchored at `(1250, 1420)`. Standard poses render at 120px visible height (`120 / 1111` scale); slide renders at 46.9px (`(64 / 1111) × 1.25`) to stay within the existing 48px clearance.
- Cavern Bat: 6 transparent PNG poses on a 2304 × 1280 canvas, anchored at `(1500, 720)`. Shared preview scale is `52 / 766`.
- Pose bounds and source-generation files are recorded in `assets/visuals/review/character-overhaul-v2/manifest.json`.
- The preview mode deliberately shows one run still and one ordinary-flight still. It is for checking artwork scale, positioning, and in-game readability before animation work.

All art changes are visual only. Existing gameplay collision geometry is unchanged.
