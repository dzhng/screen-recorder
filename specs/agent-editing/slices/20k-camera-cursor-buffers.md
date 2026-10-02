# Cursor-bounded compressed camera samples

Status: preparation next. [20j](20j-camera-range-digests.md) verifies decoded
range continuation, but its compressed readers add range-relative reset and
terminal markers. Concatenation or filtering is not an established transfer rule.

## Fixed question

Can AVSampleBufferGenerator return each stored sample with the qualified source
payload, clocks and format, without depending on partial-reader marker policy?
Use the same immutable 197-picture raw MOV and its saved native decode inventory,
complete full-reader buffer facts and encoded bytes. No writer or pixel decoder.

Create the generator with that asset and nil timebase. Request each actual source
cursor in qualified decode order with direction none and immediate mode; leave
overrideTime unset. Direction none requests only the start sample, ignoring count
limits. Preserve request identity, native cursor clocks and every returned buffer
fact, or the complete creation error, before any comparison or refusal.

Compare all payload bytes, indexed timing/size and source format with the saved
native authority. Compare complete media buffer facts with the full nil-reader
media facts, excluding only buffer ordinal; retain every field difference, both
attachment modes and raw/output clock domains. Missing or changed fields remain
explicit. This is a qualification of stored-sample generation, not permission to
discard reader markers or assume their absence preserves final duration.

## Bounds and next decision

Review and freeze one minimal private prototype and plan before execution. Reuse
the warm compiler and existing fact observer. Bounds: 150 seconds aggregate
compilation, 15 seconds native work, 180 seconds whole phase, 197 requests,
400 media samples, 2 MiB payload/file and 1 MiB per stdio stream. Preserve partial
facts before refusal; lossless compiler fixes retain rejected attempts inside
the same aggregate. No semantic tuning, native retries or accepted-cohort replay.

The result must distinguish complete observation, native-byte/clock correspondence
and full-reader fact parity. Differences select the next transfer question;
they cannot be normalized away to make parity pass. Any later writer still needs
its own prefix, complete decoded-pixel/support, terminal and lifecycle proof.
Live ownership, backlog, recovery and completed-stop performance remain open.
