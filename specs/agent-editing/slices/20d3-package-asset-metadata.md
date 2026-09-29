# 20d3 — Inventory-bound project package JSON

Status: metadata checkpoint and combined public gate verified. Dependencies: [20d2](20d2-asset-metadata-pages.md).

Complete selected history and resource metadata belong in inventory-bound JSON
members. Compact manifest references preserve the unchanged control-frame and
manifest budgets. This applies to every existing typed resource, including acquisition
support, and to revision documents; moving only asset segments leaves the same
failure in another field. Project package version 2 explicitly refuses the unshipped
inline version 1. Recording packages retain their existing format and extraction path.

The existing archive owner distinguishes parsed metadata from a ready project context.
It admits one descriptor owner, charges all eager JSON before reading, verifies exact
bytes/hash/schema/history/dependency closure, and then runs canonical media/clock
proof before publishing readiness. Cancellation and failure close that same owner.
No second metadata database, readiness registry, or mutable-path fallback is introduced.

The shared 128MiB aggregate serialized-JSON admission covers full selected history and
all resource metadata. It is a working-memory bound, not a duration limit. Export and
read apply the same bound, with typed refusal naming aggregate and maximum; no
history or empty segment rows are dropped. The measured near-boundary direct resolver
is separate from actual native archive/public relocation proof. Full 22 acceptance
retains this capacity disclosure; lazy hydration would require a separate design.

Export execution retains its complete immutable snapshot. Project-package status
reports pinned identity/history/resource counts through a covering SQLite expression
index owned by the existing export intent. Video and recording snapshot responses
remain unchanged. The index avoids parsing large JSON on polls, at the measured cost
of recomputation during lifecycle writes. It is derived storage, not another snapshot
or registry.

Verification covers 100,000-run canonical metadata, complete 10,000-clip selected
history, donor removal, adopted undo, exact ordinal rows, missing/corrupt/identity
substitution/version refusal, canonical clock relabeling, cancellation and inherited
lifetimes. Evidence and limits are in [the checkpoint](../assets/20d3-package-json/README.md).
No downstream audio-selection, capture rollout, model-quality, or listening gate is
closed by metadata portability.

The combined 10,000-clip/100,000-run public setup now passes after the existing
composition owner correction in [24g](24g-fragmented-selection.md). The original
first 500 timeout and exact committed replay remain retained. A fresh catalog format 16 donor
adopts the retained package through public admission, performs all edits, exports,
and relocates complete metadata/history to a fresh receiver. Every selected history
document, adopted undo, acquisition fact and physical segment row is checked, with
only the required evidence-file locator relocation. See [the combined gate](../assets/20d3-package-json/combined-public/README.md).
No widened deadline, owner-seeded setup, DSP or listening claim substitutes for this
proof; the unified working-memory capacity remains disclosed above.
