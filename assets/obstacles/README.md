# Obstacle Sprite Catalog

Ground slides use 24 transparent WebP paintings in `slide-landforms`. Each canvas contains the complete exposed mass, projecting lip and grounded return. Catalog lip and foot coordinates register the same painting on both sides of the actor. The remaining obstacles keep their existing foregrounds and airborne supports.

The core obstacle families have three skins per biome (50% more than the two-skin baseline). Fire keeps three skins in each biome where fire hazards appear. The biome folders and metadata below are the implementation map.

| Biome | Jump over | Slide under | Cut | Fire | Other |
| --- | --- | --- | --- | --- | --- |
| Forest | root-knot; mossy-stone-pair; root-bone-clump | Rootbound erratic, Windthrow root plate, Briar vault | thorny-young-pine; dead-oak-sapling; corn-tangle | — | — |
| Foothills | broken-fence-pile; heather-root-ball; slate-scree | Folded shale escarpment, Landslide pine wedge, Heather crag | aspen-scrub; dead-mountain-tree; antler-thicket | — | air bramble: windblown-root-tangle |
| Tundra | frozen-bone-clump; ice-boulder; snow-drift-rock | Glacial cornice, Avalanche timber pack, Serac buttress | frozen-dead-pine; frostthorn-bush; winter-reeds | — | air bramble: frostthorn-knot; snapping bramble: frost-snap-vine |
| Caves | fossil-ribs; limestone-blocks; stalagmite-clump | Fossil reef, Flowstone organ, Buried rootball | root-bramble; mushroom-tangle; fossil-antlers | ghostflame; ember-vent; fungal-fire | air bramble: cavern-root-knot |
| Crystals | blue-crystal-rock; mixed-geode-clump; violet-shard-mound | Sapphire quartz vault, Split amethyst geode, Prism fault | crystal-vine; blue-briar; amethyst-thorn | cyan-geode-fire; prismatic-vent; violet-geode-fire | air bramble: floating-prism-briar |
| Ashlands | charred-root-mass; cinder-mound; scorched-bone-pile | Basalt colonnade, Burnt cedar blowdown, Cinder buttress | charred-sapling; black-briar; ember-branch-shrub | ash-crack-fire; charred-flame-patch; smolder-bed | air tuck: basalt-tuck-gate; air bramble: charred-thorn-knot |
| Lava | basalt-teeth; cooled-lava-bulb; magma-crust-mound | Lava tube roof, Spatter rampart, Obsidian fracture | ember-root-plant; lava-glass-thorn; scorched-corn | fire-vent; lava-flare; molten-fissure | air tuck: molten-chain-tuck-gate; air bramble: ember-air-briar |
| Boss | broken-tombstone; castle-block-pile; skull-rubble | Fallen chainhouse, Ossuary abutment, Sealed gatehouse | bone-bramble; castle-creeper; spearbone-thicket | obsidian-embers; rune-fire; wraithfire-patch | — |

## Notes

- There are 96 biome-exclusive obstacle skins and eight companion paintings for the airborne combos.
- Every biome where air brambles spawn has its own dedicated foreground and cliff tether. Ashlands and Lava air-tuck gates have distinct ceiling mounts.
- Snapping bramble only spawns in Tundra, so its one sprite has a single valid biome.
- Sprite choice is deterministic from obstacle position. It does not consume gameplay RNG or read the obstacle's gameplay variant.
- Jump art draws at 2.5× its base size. Forest tree/sapling cut art draws at 3× and forest corn at 1.3× width and 1.69× height, while other biome cut art retains its previous sizing. Two point-bottomed forest jump skins and two forest cut trees have an additional visual inset into the ground. Fire draws at 2×. Air-bramble foregrounds draw at 148×218 pixels around their original 80×143 collision boxes; Ashlands and Lava air-tuck gate art draws at 196×400 and 176×400 respectively, with the lowest painted gate edge pinned to the original clearance line.
- The ground-slide rim follows the 74px collision span and the local clearance contour. Each recessed return extends into the terrain. A prepared landform is reused during a pass and released when it leaves the camera neighborhood.
