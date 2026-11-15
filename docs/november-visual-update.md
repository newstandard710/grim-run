# Air motion, Tundra, Home, and obstacle supports

Baseline: PR 83, c33cf4af582cb070f6df51e296104b04daa4e112.

## Air motion

The jump renderer uses source poses 0, 4, 12 and 16 for push-off, gathered hold, and one extension. Landing uses poses 16, 18, 20 and 23 inside the existing 175 ms post-contact timer. Hover holds pose 4; a second jump begins from an airborne extension. No simulation fields or physics were modified.

The optional 18-cell air sheet uses registered source pixels and solid interpolated edges. Rebuild with `python scripts/prepare-jump-inbetweens.py --deliberate`. The original sheet and PR 83 sheet remain available for comparison. When the new sheet is unavailable, the selected source poses still use the same cadence.
