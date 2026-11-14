# Five visual fixes

Baseline `c21a5a41c672d6fa11c3dc81e89f832ee3ec2568`. Review branch `feat/five-visual-polishes`.

1. Brittle Bones uses the existing twelve painted bone fragments to cover the tread and the exposed face. The new renderer only reads `rubble`, places all fragments from stable section coordinates, and disposes visible textures when rewind restores an opening. It shares the existing linear surface and original bank endpoints. The unfilled abyss still uses the existing walls, lips, fog and backdrop. The fallback draws bones even if the painted atlas cannot load.
2. Reaper airborne timing joins launch and rise even after an early release, shares one apex with hover, and reserves landing poses for ground contact. Thirteen derived poses bridge the largest silhouette changes with solid coverage. The original drawings, 175 ms landing timer, action priority and airborne physics are preserved. Rebuild the 294 KiB WebP with `scripts/prepare-jump-inbetweens.py`. The existing renderer is the fallback if this optional atlas fails.
3. Crawler contact, enemy animation and telegraph review pending.
4. Cold start, opening idles and home breeze review pending.
