# Durable library owners

Core owns persistent identity, revisions, source evidence, jobs and publication.
It shares one [catalog transaction boundary](src/catalog.ts). The
[package exports](package.json) identify the modules consumers can use; the
[service composition](../../apps/service/README.md) connects them to native work.
Core consumes [composition](../composition/README.md) for edit meaning instead of
maintaining another timeline interpreter.

## Assets, acquisitions and projects

An asset identifies immutable admitted bytes and their streams. An acquisition
binds those bytes to source provenance and available intervals. A project revision
places occurrences of selected streams; neither byte identity nor a recording
role selects an authored layout. The same asset can appear several times or in
several projects without merging their occurrence identities.

Stored asset metadata is a summary. Conversion consumes [fresh native facts](src/hdr-conversion-facts.ts)
from retained source bytes, including exact sample support and interpretation
evidence. Selected audio retains actual decoded native-rate runs and PCM identity
separately from video sample-cursor support; packet capacity never becomes decoded
audio evidence. Absent declarations remain absent; a successful parse does not establish
decoded appearance or authorize a treatment.

Converted assets retain their original dependency and frozen [conversion evidence](src/asset-origins.ts).
Portable adoption binds selected source and derivative occupied support to that
same clock, including unretimed media operands. A digest identifies fresh facts;
it never substitutes for those support bindings or grants conversion permission.

Read-only acoustic measurements retain the selected PCM generation and recipe.
Integrated loudness requires complete admitted support; a hole cannot become
measured silence or concatenate neighboring material. A null gate result is
evidence of measurement limits, never an instruction to normalize. Explicit
normalization publication retains complete before/after measurements and refuses
infeasible or missed requested targets. Prepared excerpts preserve that complete
processing evidence rather than relabeling it as an excerpt measurement. An explicit
prepared signal pin must match the processed output tap.

[Transcript observations](src/transcript.ts) retain overlapping estimates and true
instant points without manufacturing playable duration. [Source enumeration](src/transcript-read.ts)
returns every retained observation when unfiltered; explicit interval queries use
half-open membership. Search and caption grouping preserve the widest selected
estimate rather than assuming the final word ends latest. Text seeds keep original
word pins; a selection consisting only of points requires caller-authored text extent.

Speech preparation owns execution scope; retained reads own selection. A bounded
preparation keeps the whole-source descriptor and pins its range, decode context
and recipe in generation identity. Decoded context does not expand primary
ownership: physical gaps, unobserved support and skipped support remain distinct.
[Transcript publication](src/transcript-processing.ts) resolves omitted generation
only through full-support identity; bounded reads and project dependencies pin the
retained generation explicitly. Native windows remain raw provenance, while
connected primary observation runs preserve phrase continuity across accepted seams.

Source evidence retains its source clock. Project evidence projects it through
a revision's exact mapping without rewriting the source observation. Generation
and dependency identity bind pagination, prepared output and caches; freshness
must be rechecked when asynchronous work crosses a publication boundary.

[Anonymous acoustic observations](src/speaker-evidence.ts) retain their invocation's
slots and complete native score operands. A slot never identifies a person across
observations, and a sigmoid value never claims calibrated assignment confidence.
Captured refusal operands remain evidence; only queue settlement publishes a
validated generation. Retained reads bind that generation's original decoder,
independently of the currently installed executable or prepared runtime. Chronological
pagination preserves native row ordinals and simultaneous observations.

Project speaker reads keep the observation generation beside each clip occurrence.
Repeated uses and overlapping observations never merge anonymous slots. Coverage
separates unavailable source support from retained audio that has no observation;
neither becomes a speaker assignment. Continuations pin the selected channel,
model, revision and source generations through the existing evidence cache.
Clipping may collapse distinct starts; merge order follows chronological source
records while the returned native ordinals remain unchanged.

## Transactions, replay and lifetime

Edits commit document changes, dependency references and replay receipts together.
An uncertain answer is recovered with the original request, not a newly inferred
edit. Retained revisions keep dependencies reachable through undo. Incompatible
catalogs are refused rather than silently reconstructing missing semantic inputs;
[persisted reference fixtures](fixtures/README.md) preserve that refusal contract.

Background jobs retain attempt ownership through cancellation and resource drain.
A stale result cannot publish into a replacement attempt. Public
[job inspection](src/jobs.ts) uses the [publication contract](../protocol/README.md#published-work)
while retaining the original output identity beside current work; internal execution
and portable storage retain their serialized result contract. Readiness means admitted
and published output, not merely a completed native call. Models and generated
media share these owners rather than introducing separate queues or stores.

[Model preparation](src/models.ts) binds explicit model/runtime identities and
verified local readiness. Preparation can acquire pinned inputs; execution cannot
silently prepare another implementation. Prepared optional runtimes share one purpose-checked execution accessor; another
model purpose does not create another preparation or lifetime owner. Profiles
describe measured work bounds, not universal quality or capacity claims.
Registered acquisition policy can require explicitly supplied local model bytes;
it does not change execution identity. An already verified preparation remains
idempotent without repeating its original acquisition inputs.

## Publication and storage

Export intent pins revision and destination before execution. Acknowledgement
loss does not change that intent or repeat the content edit. Private staging
stays owned until retirement is confirmed; a committed external file remains
independent of project deletion. Portable adoption owns copied bytes and their
meaning rather than borrowing a donor path indefinitely.

The current project package format retains typed speaker generations, their full
raw native/report strings and their original publication order. The same native
parser admits live and portable observations. Older package formats are refused;
adoption stages evidence against package source facts and rechecks the published
live source owner inside the existing transaction before replaying readiness.

Deletion fences new borrowers, drains existing work and retires durable references
before removing owned files. Cache eviction cannot destroy original or generated
sources. Aggregate [storage observations](src/storage.ts) measure managed files;
shared media does not have an invented per-project byte share. Models and external
donors have separate ownership, and shutdown joins observations before closing
the catalog.
