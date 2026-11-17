# Cutscene art — v0.19.11 vendor and Bow motion

The first Angel and Devil introductions animate for three visible seconds and
hold the complete composition for one. Either phase can be skipped directly
to its vendor menu. Reduced motion opens on the same settled composition and
retains the visible-time contract.

Two distance-registered cycles of the vendor Reaper finish at 2.2 seconds.
Painted boots pivot over a fixed forefoot through heel rise. The articulated
leg chains, pelvis, chest, free arm and delayed cloak register to each load.
The scythe retains its shape and grip, with floor clearance. The gather starts
on the same touchdown painting. The lead boot holds as the trailing boot
comes in, the pelvis rises, and the hood looks up. Frame 192 holds at 3 seconds.

The merchant feet stay fixed. The Devil dips, then opens the offering claw.
The Angel dips and softens the shoulder while the lantern sways below its hook.
The left stage elements move just outside the final sightline. WebGL uses the
existing articulated mesh. Canvas samples 24 poses per merchant from the same
deformation. The Canvas WebP is 599,126 bytes at 2176 × 1344. The approach WebP is
4,544,524 bytes at 3584 × 2912. Both fit the existing transfer limits.

Rebuild the approach with `python scripts/prepare-cutscene-art.py --vendor-only`.
It uses the PR96 vendor atlas blob from local Git history, including the released
greave contours. The restored cloth follows the existing neck transform and is
composited behind the released pose. RGB is rounded to the nearest multiple of
three before lossless WebP compression. Unedited visible pixels differ by at
most one code value per color channel, and alpha changes only at the hood.
The generator preserves Bow assets and registration. Rebuild the separate
merchant strip with `python scripts/prepare-vendor-canvas.py`. No source art
is modified.

The summit acquisition uses one matching painted body/hood/scythe layer and
separate painted arm components. A continuous body hinge, knee/hip bend and
cloak follow-through preserve the character's features, while two-link arm IK
keeps the hands connected. The hood leads the reach. The second palm follows into the rim grip,
then the wrists carry the stock outward before the overhead arc. The
registered eye remains visible and clear of opaque weapon pixels. The v0.19.8 repair places pivots in the cloth elbow folds, keeps
25px upper arms and 30px forearms, and transforms native-resolution paint with
uniform scaling and premultiplied 4× supersampling. Neither elbow switches bend
side. Shoulder pivots follow the armor; the two palms match the actual stock
and forward support grips (source pixels 128,235 and 400,263). All 169 poses are baked as one solid drawing each, with no full-body
crossfade or optical-flow calculation. Closed fingers overlap the Bone Crossbow,
and the chest front plus a rim mask hide the relic while it is inside the chest.

| Seconds | Action |
| --- | --- |
| 0–0.22 | Establish the stance |
| 0.12–0.57 | Open the lid with a brief glint at the fixed rim |
| 0.22–1.65 | Load into the reach and place the two palms |
| 1.65–1.78 | Set the two-handed grasp at the rim |
| 1.78–3 | Straighten and arc the bow clear of the face |
| 3–4 | One still raised pose, cyan/ivory glow |
| 4 | Resume gameplay and grant the existing Bone Crossbow reward |

The last second has no lowering/equip tail. Existing skip, 4,900m placement,
5,000m portal, resources, vendor triggers, purchase rules and gameplay are
retained. A hidden page pauses the presentation clock; God Mode speed does not
change its timing.

## Production and reproducibility

The raw PNGs in `source/` were produced with the built-in Imagegen tool.
`production-prompts.json` records the exact prompts and reference role. The
reference is frame zero of `assets/vendors/v0152/reaper-approach.png`, preserved
in the repository. Existing merchant and Bone Crossbow textures are reused.

Run `python scripts/prepare-cutscene-art.py --bow-only` to rebuild the repaired
summit poses while retaining the accepted vendor WebP and metadata byte-for-byte.
The complete original build uses `python scripts/prepare-cutscene-art.py`, with Pillow, NumPy, SciPy and
opencv-python-headless 4.12.0.88. The script assigns connected silhouettes to
their poses before cropping (one leading boot crosses a source grid line),
registers feet/eyes at a fixed scale, restores opaque paint, builds the vendor's
articulated gait and settle, and bakes the summit body/arm rig from
`scripts/bow_rig.py`. No source PNG is modified. The game samples one solid
atlas frame. Presentation uses real visible frame timestamps, so smoothed
simulation deltas cannot stretch the four-second scenes. Visibility changes reset the
timestamp baseline without consuming hidden-page time.

`manifest.json` records exact raw/runtime SHA-256, dimensions and every frame's
bounds. `animation-data.js` records palms, overlay offsets and registration.
Runtime sheets stay below 4,096px in either dimension. Runtime source images
and hand overlays are pooled by the existing scene lifecycle.

## Review

`tests/cutscene-motion.cjs` checks hashes, registration, motion continuity,
downward gaze, grounded mesh feet and the exact final second. Arm assertions
cover both segment lengths, fixed elbow bend sides, adjacent pose continuity,
actual crossbow grip span, and rasterized sleeve/bracer width, connected paint
and opaque elbows/fists in all 169 drawings.
`tests/browser-cutscene-motion.js` renders both vendors and the complete shrine
at 950×430 and 740×360, captures critical phases and videos, and verifies the
frozen world, dense poses, both actual weapon grips throughout the lift, still
raised grip, automatic reward and cleanup.
Existing vendor, power, terrain, combat, movement and interface checks remain
release requirements. Real Android appearance/performance remains a playtest.

Arm-repair rollback base: v0.19.7, `1b1408081316ddd13555c50d298933f6cb0c5bac`.
