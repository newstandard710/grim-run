# Character preview recovery

Base: main commit 598ca21a4309e0039202cbd2b52044f6ae0163f5 (PR #16). Game title remains v0.10.4; this is an opt-in recovery, not a new gameplay release.

## Verified evidence
- 83 of 89 tracked files matched the user's intact snapshot by Git blob hash. Exactly six Reaper PNGs differed.
- All 92 PNGs in the full handoff snapshot decoded successfully.
- A downloaded damaged runtime PNG is 786444 bytes. It matches GitHub's blob hash and fails full PNG decoding. It first differs from its intact counterpart at byte 393216; corruption is not merely a clean prefix truncation.
- With the damaged file, this browser renders only a fragment of the contact pose. With intact bytes, the full Reaper renders. The exact solid-black rectangle seen on the phone has not been reproduced in this browser; phone validation remains open.
- Existing source uses shared canvases and registered poses, not a reusable layered character rig.

## Repair scope
Restore the six original PNGs unchanged. Add review-only byte/PNG integrity checks, SHA-256 verification where supported, whole-character fallback, cache identity, and asset corruption regressions. Keep default art and gameplay unchanged. Add mobile screenshot capture to the existing real-browser tests.

## Acceptance outstanding
Phone review of black rectangles, scale, running/flapping rhythm and touch controls. No live main merge until approved. Continue animation polish only after this recovery is accepted.
