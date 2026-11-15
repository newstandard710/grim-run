# Home, vendor introductions and Reaper run

Accepted base `82c3422d094250e4c7952305a95298d222cb2eee` (PR #84). This release
keeps the PR #84 air and landing animation, game simulation and previous visual
systems. Roll back to the base if a verified public regression requires it.

1. Home uses the native left-facing Crawler painting at the existing planted
   location. A cold-load test inspects the actual canvas transform in both
   orientations while checking the established Home readiness path.
2. The Angel and Devil introductions share the existing visible-time clock.
   Both ease to the full settled composition at 3 seconds and hold it through
   the 8-second menu handoff. WebGL reuses the mesh. Canvas uses the baked poses
   from the same mesh and paint. Tests cover pixels, timing, safe skip and focus.
3. The Reaper run uses one opaque painted atlas with measured stance contacts.
   Offline two-link legs hold the boot in world space through stance and lift
   during swing. The separate painted upper body provides a stable grip,
   slight weight shift, and cloak follow-through. Phase takes actual traveled
   distance. Tundra uses the same atlas contact table. A bounded rendering
   offset helps align the planted boot on slopes while the collision root stays
   at the original simulation position.

The run bake reuses the PR #84 paint. Run `python scripts/prepare-planted-run.py`
with Pillow, NumPy and OpenCV. The original run, jump, landing, and combat
assets stay in the repository. The runtime atlas is a 3072×2304 transparent
WebP and its source/runtime hashes, silhouette bounds, support positions and
footfalls are recorded in `assets/motion/v0194/manifest.json`.

## Validation and release handoff

The interrupted workspace was recovered with the three runtime changes already
present on `feat/vendor-hold-planted-run`. The remote checkpoint `97a652c`
matched the local runtime byte for byte. This checkpoint adds the v0.19.9
release marker and checks visible-time hold onset, hidden time, and a held
pointer over an actual healing purchase. The vendor and Home tests are in the
Chromium movement workflow. Compare with PR #84 for baseline captures.

Validation order is the focused Chromium runs, the full pull request checks,
then the Pages build. Verify the deployed SHA and the actual Pages bytes for
`index.html`, the Home frontispiece, both vendor modules and the two new
atlases. A fresh public session should enter through Home, show the planted
run, and exercise first-vendor handoffs before the release is called live.
