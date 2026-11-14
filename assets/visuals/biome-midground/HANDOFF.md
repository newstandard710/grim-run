# Seven-biome parallax rollout

- Approved scope: Foothills, Tundra, Caves, Crystals, Ashlands, Lava and Boss, with full test, merge and production Pages deployment authorized by Noah.
- Live baseline: b1930a49c52a8aed796cb3a388165bc5bbb6a898 (v0.19.8, approved Forest). Preserve Forest art and behavior, all gameplay and existing backgrounds.
- Feature branch: feat/all-biome-parallax. Work is committed in checkpoints. The rollout is complete only after full visual and regression review, an approved-scope merge, and public smoke verification.
- Art batches: Surface (Foothills, Tundra), cave pair (Caves, Crystals), volcanic/architecture (Ashlands, Lava, Boss). Original transparent PNG outputs and the exact ImageGen prompts are stored beside this file. Early sheets sometimes vary from the requested grid; map actual art bounds and preserve source bytes.
- Next: complete atlases, renderer/streaming, browser evidence for all seven biomes and Forest baseline, CI, merge, live hash/smoke verification.
