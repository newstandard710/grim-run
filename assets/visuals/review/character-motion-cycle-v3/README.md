# Reaper Run Cycle Rework v1

This review package contains the redesigned eight-pose Reaper run. The poses share a registered cyan-eye anchor and ground line, hold the upper body and scythe steady, and alternate the legs through a modest stride.

The runtime uses eight 360 × 360 transparent PNGs at a shared scale of `120 / 289`. They play at 12 frames per second, giving the full stride a duration of about 667ms, matching the older 12-pose cycle at 18fps. Runtime images total about 233KB.

- [Phone-scale pose review](reaper_run_cycle_balanced_phone_scale.jpg)
- [Source sheet](reaper-source/reaper_run_cycle_8pose_source.png)
- Per-frame pixel bounds, anchors, file sizes and hashes: `assets/characters/illustrated-v2/reaper/run-cycle-balanced-v1/manifest.json`

The run artwork is the only visual set changed in v0.10.8. The damage, slide, scythe, idle, jump, fall, and Bat art remain as previously approved.
