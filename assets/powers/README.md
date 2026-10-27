# Grim Run — Power and action art, v0.15.0

Built with the built-in Imagegen tool. The approved `reaper_jump_v1.png` was the character/style reference for every new asset. The two shrine states use the same shrine source as an edit reference.

## Production files

- `reaper-actions.png`: 2048 × 2048 atlas, 512px square cells. Frames 0–3 air tuck, 4–7 airborne scythe, 8–11 tucked scythe, 12–14 relic acquisition.
- `wings.png`: 2048 × 1152 atlas, 512 × 384 cells. Frames 0–3 raven; 4–7 standalone skeletal; 8–11 alternate skeletal for simultaneous Raven Wings.
- `power-effects.png`: 1024 × 768 atlas, 256px cells, in the exact `GRIM_POWER_ART.ORDER` ability order.
- `summit-shrine.png`, `summit-shrine-open.png`: the snowy mountain shrine, closed/open chest states.
- `bone-crossbow.png`: independently animated relic and firing overlay.
- `source/`: untouched original generated PNGs. `manifest.json` records source and runtime byte counts, dimensions and SHA-256 hashes.
- `../../scripts/prepare-power-art.py`: reproducible registration, connected-silhouette extraction, downsampling and atlas assembly. Requires Pillow, NumPy and SciPy; none are runtime dependencies.

Every new character pose shares a virtual `(360, 500)` anchor on a 640px production tile, downsampled to `(288, 400)` on the 512px runtime tile. Eye registration preserves the character's screen position through the action. Wing roots share `(256, 260)`; motion changes spread rather than fitting every pose to the same outer bounds. Connected-component extraction prevents neighboring robes and wide weapons from entering another animation frame. Sources are never overwritten.

## Generation prompts

Each request used `transparent_background: true`. All prompts require the approved reference's charcoal hood, layered crimson-lined robe, bronze armor, ivory skull/scythe, cyan eye, painted gothic style and consistent body proportions; no text, grids, labels or scenery in component sheets.

1. **Air tuck:** “Production transparent animation sprite sheet for Grim Run. Preserve EXACT reference character. Create four isolated right-facing full-body air-tuck frames in two columns/two rows: knees pulling inward, fully tucked, tucked with slightly different trailing robe, then legs unfolding into falling. Scythe held nearly horizontal along the compact body; robe trails left. Same character size and hip pivot. Complete silhouette inside each cell, transparent padding, no ground or effects.”
2. **Wings:** “Wings only, no character or scythe. Four columns by three rows. Row one: charcoal raven feathered wing pairs with muted violet highlights—raised, halfway down, spread/downstroke, recovery. Row two: hollow articulated ivory skeletal wing pairs with bronze joints and warm peach edges, same four phases. Row three: visibly distinct smaller lower-swept skeletal pairs, curved bone fingers reaching outward/downward, designed to appear simultaneously below raven wings. Same central attachment root across frames.”
3. **Aerial scythe:** “Four columns/two rows of right-facing attacks preserving the exact reference Reaper. Top row: airborne wind-up, forward cutting-tip-first sweep, impact reaching right, follow-through. Bottom row: the same four beats with knees pulled high in compact air tuck. Consistent head, torso and weapon sizes; complete silhouettes with transparent margins. No painted magic trails, ground or glow.”
4. **Relic acquisition:** “Three equal columns: standing Reaper reaches forward/up toward unseen treasure; both skeletal hands held overhead in an ancient relic acquisition pose, gaze upward; hands lower toward chest. Scythe safely behind the body. No weapon in hands because the relic is separately animated. Preserve costume/anatomy and a common feet baseline.”
5. **Power effects:** “Twelve isolated painted magical effects, four columns/three rows. Row one: mint scythe crescent, lavender raven feather, ice-blue broken time ring, ivory bone shards. Row two: violet inward time spiral, warm peach skeletal wing rune, amber boot-fire curl, pale cyan muzzle streak. Row three: gold-orange impact, thin lilac forked chain lightning, rose healing heart wisp, pale violet restorative soul wisp. Transparent centers and backgrounds, no inventory tiles or scenery; restrained local glow.”
6. **Summit shrine:** “Isolated snowy mountain summit shrine for a painted gothic side-scroller. Worn pointed stone arch chapel with two columns, bone runes, skull/bronze trim, dark open center and low closed ancient chest on a short plinth. Wide shallow snow-covered stone base, muted blue-gray rock and navy shadows, a few cyan rune glints. Whole structure visible on one baseline; no surrounding mountain, sky, character or floating effects.”
7. **Bone Crossbow:** “Isolated compact handheld crossbow pointing right in three-quarter side view. Ivory curved bone limbs, small central skull, antique bronze bindings, weathered wood stock, taut string and a short bone bolt with cyan tip. Match the reference scythe's painted materials. Complete silhouette with transparent padding; no hands, background, aura, text or cast shadow.”
8. **Open shrine edit:** “Edit the exact closed shrine. Change only the central chest lid: lift it upward/backward on its rear hinge and reveal a dark interior with restrained cyan light. Preserve the shrine architecture, skulls, snow, rock, columns, palette, scale, positions, canvas and transparency. No floating bow or added particles. This is the second state of the same animation asset.”

## Runtime and validation

`../visuals/power-animations.js` owns drawing, bounded bursts and wing/action frame selection. GameScene owns purchasing, damage, movement, attack windows, crossbow targeting, portal state and the single-use shrine reward. The effect layer never calls the gameplay random generator. Pose clocks live on the player and therefore follow existing rewind snapshots.

Run `node tests/power-art.cjs`, all existing `tests/*.cjs`, and `node tests/browser-power-animations.js` alongside the existing Chromium checks. The browser test captures real phone-scale sprites, the combined wing loadout, all aerial combinations, shrine phases and a WebM motion preview.
