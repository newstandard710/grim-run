# v0.19.3 — The Steady Stride

Starting speed is 300 world pixels/second. Speed rises linearly to 425 at 5,000m and stays capped at 425 thereafter.

The accepted v0.18 painted run remains the visual source. Full-body source-over crossfades reduced common opaque pixels to 75% opacity and created doubled limbs; stretching playback made this more visible. The replacement draws exactly one complete pose with constant sprite opacity. The separately painted source pose 13 had different proportions and is bridged using its accepted neighbours.

`scripts/prepare-reaper-run.py` reproducibly calculates bidirectional optical flow offline, warps both registered drawings towards each intermediate pose, interpolates their silhouette boundaries and normalizes color by coverage. Runtime does no optical flow, Canvas readback or full-body blending. Original painted source PNGs are unchanged.

192 frames in 192px cells occupy a 3072×2304 transparent atlas (about 27 MiB decoded). The shared foot anchor is [123,168]; constant scale preserves the prior on-screen character size. A complete sheet covers 752 world pixels and four authored gait beats: about 1.60–2.26 beats/second across the requested speed range. The denser frames provide about 77–109 samples/second before display sampling. Distance controls phase continuously, including acceleration, slow time, pause and rewind; gameplay clocks and jump/cut hit windows are unchanged.

Build requirements: Python 3, Pillow, numpy, scipy, opencv-python-headless 4.12.0.88. Run `python scripts/prepare-reaper-run.py` from the repository. `manifest.json` records exact original/runtime hashes, source-key correspondence and all frame bounds. `animation-data.js` supplies runtime/review geometry. The existing movement review uses the same solid atlas and 300–425 slider.

Validation covers one solid full-opacity sprite across every frame, decoded hood opacity, cyclic phase, the 300/362.5/425 speed curve, 30/60/120Hz and normal/half/quarter/frozen time. Existing action, physics, terrain, powers, combat and interface suites remain required. Physical Android presentation is the final device playtest.
