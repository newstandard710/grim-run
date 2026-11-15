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
