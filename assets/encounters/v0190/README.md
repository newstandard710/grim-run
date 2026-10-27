# v0.19.0 — Gravewing Ascension

Original PNGs in `source/` were created with the built-in Imagegen tool. `production-prompts.json` preserves the exact prompts and reference roles. Source files are retained byte-for-byte; game textures are reproducible with `python3 scripts/prepare-encounter-art.py` (Pillow, NumPy and SciPy).

- `plant-attack.png`: sixteen left-facing drawings, four columns, 384×400 cells. The fixed root is at (245,375). Idle, anticipation, bite, recoil and recovery use one shared planted base. Per-frame tooth rectangles provide jaw geometry for the real strike; adjacent drawings and rectangles interpolate together.
- `gravewing.png`: twelve integrated ivory-bone/charcoal-feather wing drawings, four columns, 512×384 cells. Eight flap drawings and four compact tuck drawings use measured shoulder roots at (256,260). These replace the two stacked wing sets only when both original powers are owned.
- `bat-flight.png`: the accepted sixteen-drawing v0.17 bat flight atlas with two registration corrections. The earlier automated eye finder selected a pink ear highlight in frames 6 and 8. Correcting those tiles by (-34,-23) and (-33,-18) pixels aligns the real near eye; every other drawing stays byte-identical at the pixel level. Both title and gameplay use this atlas.
- `manifest.json`: original and runtime sizes, SHA-256 hashes and full registration metadata.
- `animation-data.js`: runtime plant anchors and interpolated tooth rectangles; all plant gameplay state belongs to the obstacle and rewinds with it.

The accompanying gameplay checks cover actual simulation pause, both vendor types, first/repeated encounter timing, cutting and rewind, both wing purchase orders and conservative jump margins across forty seeded routes. Browser checks capture normal/paused touch controls, sixteen poses, the named offer/transformation, integrated wings, bone particles and upgraded crossbow projectiles.
