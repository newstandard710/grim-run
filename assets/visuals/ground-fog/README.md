# Ground mist — v0.19.6

The accepted painted mist banks pass behind and in front of the Reaper.
Both layers use the same opacity correction: `1 - sqrt(1 - originalAlpha)`.
For two equal full-coverage layers, `1 - (1 - alpha)^2` recovers the original
single-layer opacity. A 50% original bank uses approximately 29.29% on each
layer. Texture transparency and independent drifting silhouettes retain their
natural local variation.

Every bank is scaled 1.5× in both dimensions, with world stride and position
jitter also scaled 1.5× to retain the overlap ratio. This raises the airy mist
toward the Reaper's hips without stretching its painted shapes. The projected
base stays inset 4px against the terrain, including hills and open gaps.
Expected geometry is roughly 30–85px high, depending on the painting and width.
The v3 texture bytes, biome tints and front/rear depth order are retained.

## Height and ground-contact correction

The v0.19.4 exporter forced native 1983px-wide rows of different heights into
900×300 images. Fixed 139–159px display heights stretched the paintings by
2.48–4.69× vertically. Transparent bottom gutters then left the visible paint
roughly 4–12px above flat ground at a typical 450px bank width. A single rigid
bank tilted by at most 0.16 radians could not follow rounded hills.

The new exporter registers the visible alpha bounds with a two-source-pixel
margin, retains the generated alpha and scales both axes uniformly. Runtime
height follows each texture's own aspect ratio, giving approximately 20–57px
banks before the uniform v0.19.6 scale increase.

WebGL draws each bank with a sampled textured strip (48 columns after the
1.5× increase, retaining the original sampling distance). Every column follows the
same curved terrain profile or virtual gap surface used by the fog mask. The
visible lower edge overlaps the surface by 4px; vertical floating is removed.
Horizontal drift re-samples the surface, so it cannot lift the fog off hills.
Mesh projection remains in world pixels through texture swaps, pause, teleport
and viewport resizing. One pooled bank remains one masked render object, with
no canvas texture regeneration or GPU readback during play. Canvas retains a
correctly proportioned, registered image fallback.

Source: [mist-atlas-v2.png](source/mist-atlas-v2.png), previously generated with
built-in Imagegen. [Original selected prompt](production-prompts-v2.json).
No new artwork was generated for this correction. Rebuild with
`python scripts/prepare-ground-fog.py`; current exports are `mist-*-v3.webp`.
[Source bounds, natural sizes, and exact export hashes](manifest-v3.json).
The old v1/v2 textures remain available for rollback.

Validation: `tests/ground-fog.cjs` checks equally restored composite alpha, world anchoring,
bounded reuse, open gaps and export ratios/hashes.
`tests/browser-ground-fog-vendors.js` checks actual projected vertices, pixel
coverage at the floor, upper height, natural proportions, eight biomes, vendors
and five Reaper actions. Existing gap, movement, performance and gameplay checks
remain release requirements. Physical Android performance is a device playtest.
