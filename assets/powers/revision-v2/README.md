# v0.15.1 — Cloak Wings & Living Thorns

The revision implements the six approved playtest notes. Every new painted source was made with the built-in Imagegen tool. Exact prompts are in [production-prompts.json](production-prompts.json); original PNGs are preserved in [../source/revision-v2](../source/revision-v2).

## Runtime art

| File | Frames | Use |
|---|---:|---|
| relic-motion.png | 24 | Eight reach, eight lift and eight lower/equip poses; fixed foot anchors and separate hand metadata. |
| bone-fragments.png | 12 | Recognizable tumbling bones in the actual Brittle Bones explosion. |
| cloak-roots.png | 3 | Upright, tucked and attacking cloth folds concealing enlarged wing roots. |
| snapping-plant.png | 8 | A rooted carnivorous mouth, bending stem, fixed leaf base and existing height cycle. |

Six curved background supports are in [../../obstacles/air-bramble-support-v2](../../obstacles/air-bramble-support-v2), one per applicable biome. Their canvas edges are transparent, and their irregular roots sit behind real terrain.

The accepted wing artwork is reused at 1.5x its previous scale. Full wings sit behind the Reaper; a narrow near-root portion emerges above the cloak and is covered by a matching cloth fold. The combined loadout keeps its alternate lower skeletal pair.

`../../../scripts/prepare-visual-revision.py` selects connected painted silhouettes, registers character feet using eye/foot measurements, normalizes the particle/component sheets, and assembles the plant from complete jaws, a narrow connecting stem and one fixed base. The source files are unchanged. Pose hand coordinates and plant height data are exported to `../../visuals/revision-art.js`.

`manifest.json` records exact source/runtime byte sizes, SHA-256 hashes and runtime dimensions. Rebuild with Pillow, NumPy and SciPy; these are build tools, not browser dependencies.

## Verification

- `tests/visual-revision.cjs`: source/runtime integrity, all 24 sequential acquisition poses, and virtual fog heights across 180 seeded gaps while collisions remain unsupported.
- `tests/browser-power-animations.js`: three 50%-larger wing types, tuck scaling, layered cloak roots, actual damage-triggered bone explosion, pause/cleanup, all 24 rendered acquisition poses and unchanged reward/portal behavior.
- `tests/browser-visual-revision.js`: fixed-root plant cycle at normal/half-speed review cadence, all six supports on real terrain, and actual fog-on/off pixel comparisons over real gaps in all eight biomes.
- Existing gameplay, sprite, terrain, vendor, God Mode and rewind regressions remain required.

The shader/particle layer never changes hitboxes, movement, power balance, purchase costs or saved progression.
