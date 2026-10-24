# Mobile Reaper run cycle

This folder contains the twelve runtime run-cycle images used by the main game. Eight are compact copies of existing approved poses; four are new in-between drawings created between those poses. The large, original pose files remain unchanged in the parent folder and source archives.

The artwork is cropped to its visible silhouette and reduced to 272 visible pixels high, then rendered at the established 120-game-pixel height. Eye and ground anchors are stored in `assets/visuals/visual-system.js`. PNG palette optimization keeps all twelve files together near 300 KB, allowing the contact pose to load before the rest of the artwork.

The browser smoke test checks each file's exact byte count, SHA-256 hash, PNG integrity, decoded silhouette height, eye alignment and rendered pose changes.
