# Home composition artwork

The accepted idle Reaper PNG and forest WebP are the only sources. Their
original bytes, dimensions and use in the Main Menu and game remain intact.
Run `python3 scripts/prepare-home-art.py` with Pillow, NumPy and SciPy from
the full repository. The builder records source and export SHA-256 hashes
and frame mapping in `manifest.json`.

- `reaper-plate.webp` keeps the rigid anatomy and weapon registered to the
  original idle coordinates. The cutout overlaps the stationary part of the
  moving patch, so the joint stays beneath the forearm and outer folds.
- `cloak.webp` carries 96 poses over 3.2 seconds. The first and last poses
  share the original resting silhouette. The inner fold is anchored, with
  a delayed lift and recoil on the outer folds. Each cel has a 2 px gutter.
- `tread.webp` is a feathered path-only overlay in the original painting's
  coordinates. The same source-space tread points place the actors and
  their contact shadows through either crop.

Full-motion Home uses the registered plates as they finish loading.
Reduced motion keeps the existing idle pose and disables cloth loading.
The original Main Menu and opening readiness paths still use the original
drawings. Home closes its own decoded image bitmaps when it hands off to
the Main Menu.
