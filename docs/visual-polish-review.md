# Five visual fixes

Baseline `c21a5a41c672d6fa11c3dc81e89f832ee3ec2568`. Review branch `feat/five-visual-polishes`.

1. Brittle Bones uses the existing twelve painted bone fragments to cover the tread and the exposed face. The new renderer only reads `rubble`, places all fragments from stable section coordinates, and disposes visible textures when rewind restores an opening. It shares the existing linear surface and original bank endpoints. The unfilled abyss still uses the existing walls, lips, fog and backdrop. The fallback draws bones even if the painted atlas cannot load.
2. Reaper jump, takeoff, fall and landing registration pending.
3. Crawler contact, enemy animation and telegraph review pending.
4. Cold start, opening idles and home breeze review pending.
