# Bone & Shadow — v0.17.0

The accepted character identities, existing locomotion and environment art are preserved.
Built-in Imagegen produced the new transparent painted drawings. Generated source PNGs
are unchanged in `source/`; exact prompts are in `production-prompts.json`.

`scripts/prepare-combat-art.py` selects complete authored silhouettes, keeps their
anti-aliased alpha edges, and registers them to a common foot or eye anchor.
Overlapping source drawings are excluded rather than shipped with clipped parts.
All outputs are atomically saved, decoded and hashed. `manifest.json` records sources,
runtime dimensions, checksums and registration. No gameplay randomness is used.

| Sequence | Unique runtime drawings |
| --- | ---: |
| Ground slide + cut | 10 |
| Ground Soul Cleave | 12 |
| Standing / sliding crossbow | 8 / 8 |
| Airborne crossbow | 6 |
| Reaper hurt / defeat | 4 / 8 |
| Cavern Bat flight | 16 |
| Cavern Bat hit / defeat | 3 / 5 (one transition shared) |
| Skeletal Bat hit / defeat | 3 / 6 (one transition shared) |
| Bone Crawler hit / defeat | 3 / 6 (one transition shared) |
| Ember Imp hit / defeat | 3 / 6 (one transition shared) |
| Soul Cleave magic | 8 |
| Rapid Fire / Power Shot / Chain Shot / fire shield | 4 each |

Registered drawing blends provide continuous playback. The Cavern Bat uses exactly
the same 16 drawings and clock mapping in gameplay and the opening tableau; no pose
is independently resized to its changing wing bounds. Existing raven/skeletal wing
drawings remain, with the accepted cloak-root layers. Death's Delay and Death's
Reversal gain character afterimages; healing uses the existing authored holy flame.

Enemy defeat views have their own bounded twelve-item list. Collision and damage
stop immediately; the illustrated aftermath continues for 760ms. Rewind snapshots
store these views and enemy hit timers, so future defeats do not persist in the past.
Reaper defeat runs for 880ms with gameplay frozen before the original free-life,
paid-life or results flow. Missing new artwork retains the existing fallbacks.

Sanctuary entry uses grounded foot overlap with the existing 50m floor, including
airborne entry followed by landing. The first-per-merchant-type introduction rule
is unchanged. Original reward card DOM nodes survive purchase and healing; all cards
are crossed out after the one permitted purchase. Both merchants keep healing in
the same panel at 8 Gold per HP. Offer identity, rarity, costs and reroll quota remain
authoritative and independent of the view.

Plants are three times their v0.16.0 painted width and height, with roots registered
to the same terrain. Souls are twice their v0.16.0 painted dimensions; their pulse,
positions, collection radius and value are retained. Plant hitboxes are unchanged.
Visual spawn-overhang checks account for the larger silhouette around sanctuaries.

Rollback base: `ff3e1988829a739d49e853d907695e750e049b6e` (v0.16.0).
Validation: `tests/combat-polish.cjs`, `tests/browser-combat-polish.js`, updated
existing interface/size assertions, and all existing gameplay/art/browser suites.
