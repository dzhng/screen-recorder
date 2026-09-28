# Source scenes and occurrence events

SourceEvents merges capture observations and prepared source scenes without
inventing capture timestamps for physical picture changes. Scene availability
comes from a published preparation generation. Missing capture context does not
prevent ready scene evidence; an audio stream's unsupported scene analysis does
not erase capture observations. Scene work still pending or failed is explicit.

Scene boundary timestamps remain reduced exact fractions through composition's
existing source-point projection. Each repeated or retimed occurrence has its own
clip identity. Source/project cursors pin scene generation and selected support;
changed source preparation invalidates continuation. The existing merge budget,
manifest lifetime and heap/checkpoint owner handle scenes alongside capture rows.
Empty pages can advance a cursor, including when many tracks tie at the same time.

Indexed coverage reads retain the chunk containing the query start. This preserves
an already measured stillness start and explicit missing observations instead of
inventing a new stillness run at each query boundary. Physical/acquisition support
continues to describe gaps separately from sparse visual observations. Source
coverage is not a claim that every frame has been decoded.

## Verification scope

Core tests compare exact source and projected fractions, repeated occurrences,
range membership, mixed capture/scene ordering, limit-one pagination, generation
changes, acquisition gaps and stillness reset. A many-track case requires an empty
continuation page and then returns all retained occurrences. Existing capture
interruption/cursor and transcript query gates remain in preservation.

This pass supplies core readers and the source-event cursor schema. Public service
construction must use SourceEvents and dispatch source scene preparation. Actual
CLI/MCP scene delivery, screenshot selection and project-cut semantics remain open.
Cuts stay explicitly unsupported; no clip split is mislabeled as a source scene
change. The capture raw cursor schema and raw capture row fields are unchanged.

The final independent review confirms focused core tests but identifies two
service-adoption P1s: the renamed ProjectEvidence dependency and matching source
cursor dispatcher must change together. See [review](review.txt). No public
preservation claim is made until that parent-owned integration and live journey
complete. Core preservation passed 537 tests (one skipped), composition 121 and
protocol 18; final affected tests passed 51. [Rounding mutation](rounded-mutation.txt)
fails the exact source/project clock gates.
