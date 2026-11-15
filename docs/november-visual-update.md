# Air motion, Tundra, Home, and obstacle supports

Baseline: PR 83, c33cf4af582cb070f6df51e296104b04daa4e112.

## Air motion

The jump renderer uses source poses 0, 4, 12 and 16 for push-off, gathered hold, and one extension. Landing uses poses 16, 18, 20 and 23 inside the existing 175 ms post-contact timer. Hover holds pose 4; a second jump begins from an airborne extension. No simulation fields or physics were modified.

The optional 18-cell air sheet uses registered source pixels and solid interpolated edges. Rebuild with `python scripts/prepare-jump-inbetweens.py --deliberate`. The original sheet and PR 83 sheet remain available for comparison. When the new sheet is unavailable, the selected source poses still use the same cadence.

## Tundra

The existing cliff tile is preserved. A textured snow crust is baked into the contour-following tread cache, weighted by world position as Foothills fades into Tundra. A 32-slot powder pool uses registered footfall markers from the solid run atlas and the existing ground contact event. All through-run randomness remains on the original streams.

Both ground banks, the abyss layer and the legacy foreground haze omit pure Tundra. Transition masks use world X and the 5,000 m portal cut. The shared fog textures and the other biomes retain their settings.

## Home input

One overlay click handler covers the artwork and the accessible button. It retains a single early Home intent until the scene and menu readiness checks are installed. Focus moves to the menu heading. Pointer clicks near the Home release are briefly ignored by Start, while keyboard and assistive activations use the normal button. Global Enter and pointer Start now share the disabled-state check.

## Obstacle supports

The 24 slide variants use alpha-registered support feet. Their back plates are assembled against the upper hazard joint and two independent terrain contacts. The existing hazard and backing remain a matched pair. Canvas textures are cached by obstacle geometry and discarded when the mount leaves view, its obstacle disappears, or the scene ends. Rebuild the measured contact metadata with `python scripts/register-obstacle-mounts.py`.

Air-bramble tethers share the two painted endpoints with the solid bank and the top of each bramble. Tuck mounting uses the current obstacle height after resize, with chain spans matched to their foreground gate. Low obstacles sample the real ground at their painted foot patch and follow the local slope. Upright cut trees and plants preserve the existing sprites and strike timing.
