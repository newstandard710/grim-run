# Forest middle-background pilot

This optional Forest artwork uses the approved landscape as the distant painting.
The two bands are behind the existing background veil and move at 16% and 42%
of horizontal camera displacement. The Forest biome weight fades them away
from 720–1,080 m. The run seed and absolute scenery cell determine tree variety,
grouping and clearings. A near oak frames the entrance before the first
clearing. Each illustration registers to its painted root contact, and its
supporting bank follows the same projected slope. Foreground terrain covers
overlapping roots, and the existing abyss rim clips scenery inside open drops.
Rendering never consumes the gameplay RNG.

`source/` contains the two unmodified built-in ImageGen sheets.
`production-prompts.json` records the exact prompts and the shipped style
reference. `forest-midground.json` includes the source checksums, crop windows,
atlas rectangles and checksum, and the encoder versions. To rebuild the
atlas and metadata from the PNGs, run:

```sh
python scripts/prepare-forest-midground.py
node tests/forest-midground-assets.cjs
```

The packer trims alpha residue at 3/255 or below, scales each cutout uniformly,
and leaves eight pixels of transparent padding per cell. The runtime loads one
1,280 × 864 WebP and creates up to 14 reusable Phaser images. Append
`?forestMidground=0` to a pilot build to see the existing scene and omit the
atlas from the load. The browser workflow checks identical gameplay and RNG
with scenery enabled and disabled, and compares matched footage with the
previous live Forest renderer.
