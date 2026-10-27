# Fluid Bat Flight — v0.19.2

The old 16-drawing loop changed torso angle, proportions and wing direction between drawings, with an uneven second rise/hold. Eye registration did not correct those internal changes. Crossfading complete overlapping silhouettes also reduced their opaque body coverage to 75% at transition midpoints, producing a repeated brightness pulse.

The current loop rigs the accepted first painted bat from `assets/encounters/v0190/bat-flight.png`. Canvas masks separate its rear wing, leading wing and body. A triangulated wing surface follows continuous shoulder rotation, delayed wrist flex and a slightly folded return stroke. The same painted face, torso and feet remain in every pose; subtle pitch/bob pivot around the near eye. No new character painting is introduced.

`assets/visuals/bat-flight.js` owns the rig, phase mapping, registration and shared Canvas drawing. `scripts/prepare-bat-flight.cjs` bakes 96 poses into 256×256 cells, eight columns, retaining the old displayed body scale. Install Playwright 1.56.1 and Chromium, then run `node scripts/prepare-bat-flight.cjs`. Mesh deformation is an offline build step; runtime uses a single atlas lookup and solid sprite, without a full-body crossfade or per-frame mesh work.

One flap lasts 1.6 seconds (40% slower than 0.96 seconds). There is one downstroke and return per loop, with continuous pose and velocity at the seam. The home placement uses the complete loop silhouette, with a portrait size cap and edge margin so all wing extremes remain on screen. Home and gameplay use identical sampling; gameplay phase stays tied to simulation elapsed time, including slow time, pause and rewind. Dive/recovery retain their existing timing and dedicated art.

`manifest.json` records the source hash, runtime hash, registration, cadence and all 96 alpha bounds. [Review at home/game sizes](review.html). Rollback base: `6fb1afe5320d12776ab20a978bef93e6209981a7` (v0.19.1).
