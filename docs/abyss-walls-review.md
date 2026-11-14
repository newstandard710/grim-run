# Abyss wall and fog review

Baseline `4b3dcf30f9520551c1ea97398ce41fdf1f6a3f54`. Branch `feat/abyss-walls-fog`, [PR #81](https://github.com/newstandard710/grim-run/pull/81).

The full-depth foreground body and texture share a deterministic profile. The separate top lip follows the actual terrain curve and ends at the real edge. Surface mist uses a 44-world-pixel starting feather, reduced on narrow banks. The abyss mist uses the existing painting with a 68-pixel inset and a soft four-sided alpha envelope. No source art, midground code, gameplay terrain, RNG or cutscene timing changed.

- 22 Node suites, SVG validation and the real eight-biome fog/character depth test passed locally.
- 1,200 paired Chromium steps matched gameplay, terrain generation and RNG, including gap fill. Lifecycle checks covered pause, rewind, restart, death, portal entry/exit, finish and extended Boss plus rapid teleports and delayed/missing atlases.
- 406 frames per renderer checked all eight biomes, six fades, deep camera movement, narrow/wide gaps, unequal lips, both landscape sizes, portrait and rotation recovery. The unequal-lip capture uses a 30 px staged difference.
- WebGL and Canvas pixel probes passed with no surface mist inside the opening and visible subdued mist below it. Peak counts were 64 cached wall profiles, 20 surface banks and six visible abyss mist views. CPU drawScene p95 was 6.2 ms in WebGL and 3.2 ms in Canvas on this host. Physical Android was outside this review.

[Motion reel](https://chatgpt.com/library?file_id=libfile_fde3_f-b596a53acbb081919430b60a20dca9bc_341adfe3367c819190414eee62b400ed&account_id=personal) · [Validation metrics](https://chatgpt.com/library?file_id=libfile_fde3_f-cf1ad0bff0c48191b42ce46d228b70b7_341adfe3367c819190414eee62b400ed&account_id=personal)

## Live release

- Tested PR head `912632b012b075d560aa9d94af04343ee247904c`. [Regression](https://github.com/newstandard710/grim-run/actions/runs/43633505585), [Interface](https://github.com/newstandard710/grim-run/actions/runs/43633505616) and [all five Chromium groups](https://github.com/newstandard710/grim-run/actions/runs/43633505596) passed. The approved timing exception was unused.
- PR #81 merged as `19df4a68870bc5c87c07c1d9500ca714a08768c9`. Its tree matches the tested head. [Pages build and deployment](https://github.com/newstandard710/grim-run/actions/runs/43634750480) passed.
- Public HTML, both scenery renderers and 37 metadata or texture files matched the merge commit byte for byte (4,289,913 bytes total). Public Chromium started the game, ran and jumped from input, loaded Forest and all seven native scenery sets, crossed the 5,000 m portal, reached the 9,999 m finish and drew Boss at 19,500 m. An actual cave gap confirmed the exact rim anchor, jagged deep wall, null ground and ground fog at gap center, and separate inset mist.
- [Verified live game](https://newstandard710.github.io/grim-run/index.html?release=19df4a68870bc5c87c07c1d9500ca714a08768c9).
