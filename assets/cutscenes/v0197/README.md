# v0.19.7 — Relics & Reckonings

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

The summit acquisition uses eight newly authored bend/reach/grip/lift/overhead
key poses of the accepted Reaper identity. Optical-flow registration bakes 169
solid drawings, rather than overlapping full-character fades. The palms and
Bone Crossbow follow per-frame grip metadata. A cropped existing chest front
occludes the low reach so the relic emerges from inside the chest.

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

The two raw PNGs in `source/` were produced with the built-in Imagegen tool.
`production-prompts.json` records the exact prompts and reference role. The
reference is frame zero of `assets/vendors/v0152/reaper-approach.png`, preserved
in the repository. Existing merchant and Bone Crossbow textures are reused.

Run `python scripts/prepare-cutscene-art.py` with Pillow, NumPy, SciPy and
opencv-python-headless 4.12.0.88. The script assigns connected silhouettes to
their poses before cropping (one leading boot crosses a source grid line),
registers each foot baseline with one fixed scale, restores opaque source
interiors, computes bidirectional flow and interpolates moving alpha boundaries.
No source PNG is modified. The game samples one solid atlas frame.

`manifest.json` records exact raw/runtime SHA-256, dimensions and every frame's
bounds. `animation-data.js` records palms, overlay offsets and registration.
Runtime sheets stay below 4,096px in either dimension. Runtime source images
and hand overlays are pooled by the existing scene lifecycle.

## Review

`tests/cutscene-motion.cjs` checks hashes, registration, motion continuity,
downward gaze, grounded mesh feet and the exact final second.
`tests/browser-cutscene-motion.js` renders both vendors and the complete shrine
at 950×430 and 740×360, captures critical phases and videos, and verifies the
frozen world, dense poses, still raised grip, automatic reward and cleanup.
Existing vendor, power, terrain, combat, movement and interface checks remain
release requirements. Real Android appearance/performance remains a playtest.

Rollback base: v0.19.6, `07c002ba618948228563f15d956a7a32b31b0ef6`.
