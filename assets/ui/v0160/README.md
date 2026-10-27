# Beyond Death — v0.16.0

The opening tableau uses the accepted Reaper idle, Cavern Bat flight cycle,
Bone Crawler and Ember Imp illustrations without modifying those originals.
`frontispiece.js` finds transparent content bounds once on loading, composites
the original files at display scale, and adds restrained breathing, flight,
mist and motes. Its animation stops during gameplay or while the page is hidden.
Reduced-motion preference disables animated presentation.

Two new assets were produced with the built-in image generation tool. The
unmodified original PNG bytes are retained in `source/`. Production WebP files
were encoded at quality 89 with Pillow (method 6), without changing composition.

- `veil-forest.webp` — forest threshold environment, 1672 × 941.
- `reliquary-stone.webp` — quiet painted stone surface, 1536 × 1024.
- `interface.css` — shared aged-bronze, painted-stone and ivory menu styling.
- `fonts/` — locally hosted variable Cinzel headings and Source Sans 3 body
  lettering, obtained from the official `google/fonts` repository. SIL Open
  Font Licenses are included beside both fonts.

New control symbols are deterministic inline SVG relief-style pictograms.
Gameplay characters and environments remain painted raster artwork.

## Environment generation prompt

Use case: stylized-concept. Asset type: finished wide 16:9 landscape game title-screen environment illustration, no lettering. Reference images already shown: the haunted forest is the authoritative rendering style and palette; the Reaper sheet establishes a gothic hand-painted cartoon universe. Primary request: paint an epic dark fantasy clearing at the threshold of the Underworld for GRIM RUN. Ancient twisted burgundy-leaved trees, layered cool navy shadows, a distant broken gothic arch with a restrained cyan glow through it, winding rocky mossy path, dim moon far behind branches, subtle ground mist, depth and clear chunky silhouettes. Rich illustrated storybook finish matching the reference forest, not photoreal or 3D. Composition: landscape 1920x1080-like wide canvas; dark foreground rock ledge along lower 20%; open space at left third for our existing Reaper sprite, middle 40% quiet and dark enough for overlaid cream game title and central button; framing branches and rocks at edges; distant arch slightly right of center, atmosphere deep into the woods. Our existing enemy sprites will be composited later at right and upper edges. No characters, no monsters, no skull figures, no text, no logos, no watermarks. No UI, no buttons in the painting. Cool slate/cyan restrained moonlight, muted moss and burgundy leaves, tiny antique amber glints; bright accents should not wash out the quiet center.

Reference files: `assets/visuals/biomes/forest.webp` and
`assets/visuals/review/character-overhaul-v2/reaper_static_pose_review_dark.jpg`.

## Material generation prompt

Use case: stylized-concept. Asset type: dark painted stone material texture for gothic storybook game UI, 1536x1024 landscape. A single uninterrupted near-black charcoal and deep navy weathered stone surface, faint fine grain and irregular brushwork, very subtle worn antique bronze scratches sparsely near the outer edges. The center must be dark, quiet, uniform and very readable under cream text. Hand-painted smooth illustrated finish to match Grim Run haunted forest artwork. Restrained contrast, no bright cracks. Entire canvas filled by material, front-on perfectly flat; no perspective. No objects, no figures, no text, no symbols, no frames, no UI, no watermarks.
