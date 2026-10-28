# Cutscene art — v0.19.8 arm repair, v0.19.7 vendor motion

The first Angel and Devil introductions retain their ten-second presentation
clock and existing skip/offer rules. A new scythe-gripping Reaper has 96 dense
walking frames, 97 approach-to-stance frames and 48 planted breathing frames.
Walking uses two-link painted legs with fixed boot contacts and curved swing strokes. Its phase follows eased travel, ending on the same contact painting that
begins settling. The idle deforms only the hood, shoulders and trailing cloth;
boots and gripped staff are excluded.

Both accepted merchant paintings are retained byte-for-byte. A small WebGL mesh
articulates the torso, hood/head and cloth without scaling the whole body.
The downward head turn starts at seven seconds, settles by 9.25 seconds and
holds through the end, with the head turning toward the smaller Reaper.
Mesh updates use presentation time and contain no image readback or gameplay
randomness. Fixed bottom vertices retain planted feet.

The summit acquisition uses one matching painted body/hood/scythe layer and
separate painted arm components. A continuous body hinge, knee/hip bend and
cloak follow-through preserve the character's features, while two-link arm IK
keeps the hands connected. The wrist path arcs around the face before arriving
overhead. The v0.19.8 repair places pivots in the cloth elbow folds, keeps
25px upper arms and 30px forearms, and transforms native-resolution paint with
uniform scaling and premultiplied 4× supersampling. Neither elbow switches bend
side. Shoulder pivots follow the armor; the two palms match the actual stock
and forward support grips (source pixels 128,235 and 400,263). All 169 poses are baked as one solid drawing each, with no full-body
crossfade or optical-flow calculation. Closed fingers overlap the Bone Crossbow,
and the chest front plus a rim mask hide the relic while it is inside the chest.

| Seconds | Action |
| --- | --- |
| 0–0.4 | Establish and open chest |
| 0.4–1.5 | Bend knees/hips and reach down into chest |
| 1.5–1.8 | Settle at deepest reach; grip at 1.65s |
| 1.8–3 | Stand and lift overhead |
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
summit poses while retaining the accepted vendor PNG and metadata byte-for-byte.
The complete original build uses `python scripts/prepare-cutscene-art.py`, with Pillow, NumPy, SciPy and
opencv-python-headless 4.12.0.88. The script assigns connected silhouettes to
their poses before cropping (one leading boot crosses a source grid line),
registers feet/eyes at a fixed scale, restores opaque paint, builds the vendor's
leg rig and in-betweens, and bakes the summit body/arm rig from
`scripts/bow_rig.py`. No source PNG is modified. The game samples one solid
atlas frame. Presentation uses real visible frame timestamps, so smoothed
simulation deltas cannot stretch the 10s/4s scenes; visibility changes reset the
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
