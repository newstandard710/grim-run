# Vendor, Bow and Bone Crawler motion handoff

- Baseline: PR87, `9de9204c1a3712620a5cec3100b648b0a19f9961`, tree `ea8adff742817ba74d2f0221dd6ee652b7b90606`. Main and the live HTML matched at phase entry.
- Argus approved the four-item preflight under Noah's delegated authority. Implement and review the two vendors first, then Bow, then the Crawler. PR, merge, and Pages release are authorized after the affected checks and moving reviews pass.
- Contracts: vendors animate for 3 visible seconds and hold the complete composition for 5, with safe anytime skip. Bow retains the 4-second event, reward, and existing skip route. The Crawler retains exact gameplay and response timing, including readiness and fallback outcomes. Gameplay RUN/CUT, physics, damage, and RNG remain protected.
- Baseline preflight file: `libfile_fde3_f-9ad3957afc4c819187ad28b28de1bf5f_341adfe3367c819190414eee62b400ed`. Moving baselines: `libfile_fde3_f-37cc9da874b88191871c137a15b9d3ab_341adfe3367c819190414eee62b400ed` (see preflight links for authoritative clip IDs).
- Status: baseline recovered. Vendor implementation and tests are in progress. Capture exact SHA, file hashes, and importable Library bundle at each completed phase. Record any omitted checks and the real-device limitation.
