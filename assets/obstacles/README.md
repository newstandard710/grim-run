# Obstacle Sprite Catalog — v0.14.9

The catalog has 96 biome-exclusive skins. Jump, cut, fire, and special obstacle foregrounds are transparent PNGs; the 24 slide variants have transparent WebP front/back pairs in `slide-v3`. Every slide obstacle also has a unique companion support in `slide-support`. Six jump-plus-attack brambles and both jump-plus-tuck gates now have their own paired supports in `air-bramble-support` and `air-tuck-support`. Each support is tied to its own foreground skin, draws behind terrain, and matches its biome's material. Grounded sprites use per-image alpha baselines plus a small visual inset into terrain. Fire artwork displays at 2×.

The core obstacle families have three skins per biome (50% more than the two-skin baseline). Fire keeps three skins in each biome where fire hazards appear. The biome folders and metadata below are the implementation map.

| Biome | Jump over | Slide under | Cut | Fire | Other |
| --- | --- | --- | --- | --- | --- |
| Forest | root-knot; mossy-stone-pair; root-bone-clump | dead-bough-curtain; root-shelf; thorn-canopy | thorny-young-pine; dead-oak-sapling; corn-tangle | — | — |
| Foothills | broken-fence-pile; heather-root-ball; slate-scree | fallen-pine-overhang; grass-root-ledge; rock-lip | aspen-scrub; dead-mountain-tree; antler-thicket | — | air bramble: windblown-root-tangle |
| Tundra | frozen-bone-clump; ice-boulder; snow-drift-rock | frozen-pine-limbs; ice-lip; snow-shelf | frozen-dead-pine; frostthorn-bush; winter-reeds | — | air bramble: frostthorn-knot; snapping bramble: frost-snap-vine |
| Caves | fossil-ribs; limestone-blocks; stalagmite-clump | fossil-rib-arch; hanging-roots; stalactite-curtain | root-bramble; mushroom-tangle; fossil-antlers | ghostflame; ember-vent; fungal-fire | air bramble: cavern-root-knot |
| Crystals | blue-crystal-rock; mixed-geode-clump; violet-shard-mound | blue-crystal-ceiling; prism-canopy; violet-geode-shelf | crystal-vine; blue-briar; amethyst-thorn | cyan-geode-fire; prismatic-vent; violet-geode-fire | air bramble: floating-prism-briar |
| Ashlands | charred-root-mass; cinder-mound; scorched-bone-pile | basalt-shelf; blackroot-curtain; charred-bough | charred-sapling; black-briar; ember-branch-shrub | ash-crack-fire; charred-flame-patch; smolder-bed | air tuck: basalt-tuck-gate; air bramble: charred-thorn-knot |
| Lava | basalt-teeth; cooled-lava-bulb; magma-crust-mound | basalt-lip; lava-glass-shelf; slag-teeth | ember-root-plant; lava-glass-thorn; scorched-corn | fire-vent; lava-flare; molten-fissure | air tuck: molten-chain-tuck-gate; air bramble: ember-air-briar |
| Boss | broken-tombstone; castle-block-pile; skull-rubble | bone-arch; chain-stone-lintel; ruined-portcullis | bone-bramble; castle-creeper; spearbone-thicket | obsidian-embers; rune-fire; wraithfire-patch | — |

## Notes

- The catalog contains 96 unique foreground skins: 24 jump, 24 slide, 24 cut, 15 fire, 2 air-tuck, 6 air-bramble, and 1 snapping-bramble. Slide adds 24 upper paintings and 24 supports; airborne combos add 8 distinct supports.
- Every biome where air brambles spawn has its own dedicated foreground and cliff tether. Ashlands and Lava air-tuck gates have distinct ceiling mounts.
- Snapping bramble only spawns in Tundra, so its one sprite has a single valid biome.
- Sprite choice is deterministic from obstacle position. It does not consume gameplay RNG or read the obstacle's gameplay variant.
- Jump art draws at 2.5× its base size. Forest tree/sapling cut art draws at 3× and forest corn at 1.3× width and 1.69× height, while other biome cut art retains its previous sizing. Two point-bottomed forest jump skins and two forest cut trees have an additional visual inset into the ground. Fire draws at 2×. Air-bramble foregrounds draw at 148×218 pixels around their original 80×143 collision boxes; Ashlands and Lava air-tuck gate art draws at 196×400 and 176×400 respectively, with the lowest painted gate edge pinned to the original clearance line.
- Slide-under art draws at 3.25× its base size and replaces the old procedural pillar. Its lowest visible point sits at the existing slide-clearance contour and the artwork follows nearby terrain slope. No placement, collision, spawn, or timing values are changed.
