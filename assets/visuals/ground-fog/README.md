# Ground mist — v0.19.4

Four new transparent painted mist banks replace the former outlined, solid
cloud shapes. The neutral gray artwork is tinted by the original eight biome
palettes. The generated alpha carries airy upper wisps and denser lower flow.
Original v1 files remain available for rollback.

The game draws one set at depth 11.4 and another at depth 15, enclosing the
Reaper's normal, motion, action and fallback renderers. Each uses exactly
0.5 times the original biome/variation alpha, including section-local banks.
Rear banks use a separate deterministic seed, a 0.47-stride offset and slower
drift. Width, flip and silhouette vary without consuming gameplay randomness.
The shared terrain mask and virtual gap surface preserve continuous chest-high
mist across open abysses; the separate deep-ravine fog is unchanged. Banks
gently follow the slope, and localized wisps use full world-space section
midpoints so camera movement cannot move them along a ledge.

Source: [mist-atlas-v2.png](source/mist-atlas-v2.png), generated with the built-in
Imagegen tool. [Exact selected production prompt](production-prompts-v2.json).
The follow-up atlas variation was rejected; only the selected source is used.
`python scripts/prepare-ground-fog.py` crops four rows and resamples/exports
900×300 lossless WebP files, retaining the generated alpha. No background
removal, recoloring or synthesized replacement texture is performed offline.
[Source/runtime hashes and crop coordinates](manifest-v2.json).

Two half-opacity layers combine slightly lighter than one full-opacity layer
under ordinary alpha compositing. Their offset silhouettes preserve the banked
atmosphere while leaving the Reaper exposed to only the front half.

Validation: `tests/ground-fog.cjs` and
`tests/browser-ground-fog-vendors.js` check the opacity contract, stable camera
placement, bounded sprite reuse, actual decoded texture loading, all eight
biomes, five Reaper actions and vendors. Existing continuous-gap, movement,
world/terrain and gameplay suites remain release checks. Browser captures in
`test-results/` are temporary review evidence; Android feel remains a device
playtest.
