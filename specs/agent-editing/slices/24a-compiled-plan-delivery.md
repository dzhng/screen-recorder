# 24a — Deliver bounded compiled plans outside control frames

Status: verified transport prerequisite; [evidence](../assets/24a-compiled-plan/README.md). Dependencies: [05](05-compiler.md), [09](09-first-preview.md). This does not close whole-project scale or active-mixer bounds.

The declared 10,000-occurrence fixture produces a compiled audio request larger
than the control frame. Preserve that frame limit and the existing compiler/native
plan meaning. The service chooses inline delivery for small audio/movie parameters
and an attempt-owned regular file for larger parameters. Both reach the same strict
typed decoder and executor. A file envelope cannot also contain inline settings.

The existing render attempt owns the file and its inherited workspace lock. The
native reader admits an absolute regular file with a bounded size, rejects a final
symlink, and reads in bounded chunks before parsing. This is ordinary native file
input, not a claim that arbitrary caller paths have descriptor-pinned ancestors.
No new queue, plan schema, cache, media representation or public setting is added.

The compiled file limit is 64 MiB, above the measured 17.4 MB basic 10,000-occurrence
plan. Enriched plans can still exceed it and must refuse; this is not unlimited
project support. JSON validation precedes transport selection, so undefined fields
and nonfinite values cannot disappear during serialization.

Run `node packages/test-harness/editing/compiled-plan.mjs --out /tmp/NEW-PLAN`
with `SCREENREC_NATIVE` selecting the built worker. The service renderer and actual
native worker must preserve exact WAV samples and decoded movie audio/video between
small and oversized equivalent plans, then remove attempt files after success,
invalid input and cancellation. Focused service/native tests pin complete plan
content, strict envelope/body validation and file-size/type refusal. Retain the
old-worker red and restored green. No new visual design or listening verdict follows
from transport parity; full scale remains in24 and its mixer prerequisites.

Delegated: helper names and chunk size. Control-frame limits, one plan meaning,
existing attempt lifetime and explicit oversized refusal are fixed.
