# Reaper scythe swing v1

Four transparent, mobile-sized Reaper drawings replace the single static attack pose in the main visual set. The sequence is **wind-up → sweep → impact → follow-through**. It fills the existing 260 ms attack animation window and keeps the existing attack timing, reach, damage, and controls.

The runtime PNGs are 477 × 477 pixels with anchors registered to keep the Reaper's feet and body size stable across the changing scythe poses. The full-size source drawings and slide source are kept under `assets/visuals/review/reaper-scythe-swing-v1/source/`; `reaper_scythe_swing_contact.png` shows the four attack frames together. Runtime sizes and SHA-256 hashes are checked by `tests/asset-integrity.cjs`; `tests/browser-visual-smoke.js` checks the actual pixels drawn in a mobile-sized game canvas.
