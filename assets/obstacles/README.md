# Obstacle Sprite Catalog — v0.14.2

All sprites are transparent RGBA PNGs authored at three times their base display dimensions. Runtime visual multipliers enlarge jump, slide, and cut art without changing hitboxes. Grounded sprites use per-image alpha baselines plus a small visual inset into the terrain. Slide sprites use a biome-colored support behind the illustrated obstacle. Every skin remains assigned to one biome.

The core obstacle families have three skins per biome (50% more than the two-skin baseline). Fire keeps three skins in each biome where fire hazards appear. The biome folders and metadata below are the implementation map.

| Biome | Jump over | Slide under | Cut | Fire | Other |
| --- | --- | --- | --- | --- | --- |
| Forest | root-knot; mossy-stone-pair; root-bone-clump | dead-bough-curtain; root-shelf; thorn-canopy | thorny-young-pine; dead-oak-sapling; corn-tangle | — | — |
| Foothills | broken-fence-pile; heather-root-ball; slate-scree | fallen-pine-overhang; grass-root-ledge; rock-lip | aspen-scrub; dead-mountain-tree; antler-thicket | — | air bramble: windblown-root-tangle |
| Tundra | frozen-bone-clump; ice-boulder; snow-drift-rock | frozen-pine-limbs; ice-lip; snow-shelf | frozen-dead-pine; frostthorn-bush; winter-reeds | — | snapping bramble: frost-snap-vine |
| Caves | fossil-ribs; limestone-blocks; stalagmite-clump | fossil-rib-arch; hanging-roots; stalactite-curtain | root-bramble; mushroom-tangle; fossil-antlers | ghostflame; ember-vent; fungal-fire | — |
| Crystals | blue-crystal-rock; mixed-geode-clump; violet-shard-mound | blue-crystal-ceiling; prism-canopy; violet-geode-shelf | crystal-vine; blue-briar; amethyst-thorn | cyan-geode-fire; prismatic-vent; violet-geode-fire | air bramble: floating-prism-briar |
| Ashlands | charred-root-mass; cinder-mound; scorched-bone-pile | basalt-shelf; blackroot-curtain; charred-bough | charred-sapling; black-briar; ember-branch-shrub | ash-crack-fire; charred-flame-patch; smolder-bed | air tuck: basalt-tuck-gate |
| Lava | basalt-teeth; cooled-lava-bulb; magma-crust-mound | basalt-lip; lava-glass-shelf; slag-teeth | ember-root-plant; lava-glass-thorn; scorched-corn | fire-vent; lava-flare; molten-fissure | air tuck: molten-chain-tuck-gate; air bramble: ember-air-briar |
| Boss | broken-tombstone; castle-block-pile; skull-rubble | bone-arch; chain-stone-lintel; ruined-portcullis | bone-bramble; castle-creeper; spearbone-thicket | obsidian-embers; rune-fire; wraithfire-patch | — |

## Notes

- The catalog contains 93 unique files: 24 jump, 24 slide, 24 cut, 15 fire, 2 air-tuck, 3 air-bramble, and 1 snapping-bramble.
- Air-bramble appearances without a dedicated air-bramble entry use a cuttable sprite from that same biome. The art remains biome-local.
- Air-tuck art is assigned to Ashlands and Lava; occurrences in other biomes keep the existing procedural gate rendering.
- Snapping bramble only spawns in Tundra, so its one sprite has a single valid biome.
- Sprite choice is deterministic from obstacle position. It does not consume gameplay RNG or read the obstacle's gameplay variant.
- Jump art draws at 2.5× its base size. Named trees and saplings in the cut family draw at 2×; the other cut sprites are 1.3× taller. Fire sprites and air tuck, air bramble, and snapping bramble retain their current display sizing.
- Slide-under art draws at 3.25× its base size and replaces the old procedural pillar. Its lowest visible point sits at the existing slide-clearance contour and the artwork follows nearby terrain slope. No placement, collision, spawn, or timing values are changed.
