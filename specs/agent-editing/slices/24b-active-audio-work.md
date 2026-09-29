# 24b — Bound active audio work independently of timeline length

Status: five-minute/500-occurrence learned preparation verified; the
[two-hour checkpoint](24f-successful-learned-scale.md) now passes after its retained
public setup/delivery prerequisites. [Evidence](../assets/24b-active-audio/README.md).
Dependencies: [24a](24a-compiled-plan-delivery.md).
This is a prerequisite of 24 and the remaining 15a2 scale gates, not their closure.

The existing native Graph owns immutable routing and support metadata. A Stream
opens cursors lazily, visits only active child branches, and releases a cursor
when a prepared replacement or inactive interval removes its contribution.
Prepared spans independently activate their routing ancestors through source
silence. Child order, exact half-open boundaries, exclusive prefix endpoints,
missing-state refusals and IEEE signed-zero arithmetic remain observable contracts.

Structural timeline bounds and simultaneous decoder bounds protect different
resources. Sequential occurrences may exceed the active-source budget; actual
readable overlap may not. Routing buffers retain the existing bounded budget.
Foundation temporaries in synchronous spool loops drain per chunk, so completed
chunks do not retain memory until the full learned program ends. No second mixer,
queue, prepared store, model recipe or transport schema is introduced here.

The frozen complete-PCM gates remain authoritative for DSP arithmetic. The scale
fixture additionally compares complete PCM with independent frozen mono reference
runs for both authored lanes, alongside full count and retained late/full equality,
resource observations and cleanup, not independent speech quality. General deep
routing still costs events × depth; no claim of whole-24 bounded query acceptance
or listening follows from one shallow repeated-source fixture.

The [edit batching checkpoint](24c-edit-batch-work.md) localizes and repairs repeated
resolution while preserving the timed-out committed revision. Public receipt delivery
is the next prerequisite before the declared two-hour/10,000-occurrence preparation. Post-retime processing remains dependent on 14's native
stretch binding; the isolated 13b adapter does not enable that execution path.
