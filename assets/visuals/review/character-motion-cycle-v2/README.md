# Reaper run cycle review v2

This is the main-game Reaper motion cycle. It keeps the approved Reaper design and four existing run drawings, adds four earlier transition drawings plus four new in-between poses, and runs the twelve poses at 18 frames per second. The cycle keeps the same overall stride timing as the former eight-pose cycle. The previous illustrated poses remain available with `?art=illustrated`; gameplay systems are unchanged.

The phone recording showed that the run looked like it was popping between poses. The original eight poses are now interleaved with four new drawings to reduce the jump between the most different poses. They play at 18 frames per second, preserving the former cycle duration. Each pose uses a compact image sized for the actual game character, so the full run cycle is about 300 KB instead of more than 15 MB. The verified contact pose loads first, and the Start button stays in a short loading state until that pose is ready. The other run poses load next; secondary Reaper and Bat art loads afterward.

The original eight full-size art files remain unchanged. Compact versions and four new in-between poses are stored in `assets/characters/illustrated-v2/reaper/run-cycle-mobile-v1/`. All twelve are aligned to a 120px visible-height target and carry SHA-256 and full PNG-chunk checks. The earlier original-source manifest remains unchanged.

Browser checks validate every runtime PNG's byte count, SHA-256, PNG chunks, decoded pixels, visible height, eye alignment, startup gating, and twelve distinct rendered frames in a mobile-sized Phaser canvas. The phone test remains the final check for whether the rhythm feels natural in play.
