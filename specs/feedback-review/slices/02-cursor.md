# Cursor review frames

Render up to eight source/project frame times with explicit trailUs through existing pointer preparation and compositor, without persistent project or revision edits. Share frame batch delivery/retry, per-item order/error and identity semantics. Preserve actual source and project sample clocks, transforms, gaps and capture authority. Avoid duplicate authored pointer overlays; caller trail is the review treatment, source capture pointer baked into pixels remains source evidence. No synthetic pointers across gaps.

The shared source/project delivery path is implemented. Source requests now carry an ephemeral overlay into native source-frame rendering; project requests continue to use the compiled ephemeral composition. Remaining verification is native fixture comparison, retry/cache coverage, and the visual review gates below.
