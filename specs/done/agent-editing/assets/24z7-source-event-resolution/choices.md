# 24z7 implementation choices

## Sound

### Share a selection lookup owner, not caller-supplied evidence facts

When a caller continues a project event query containing two captures of the same movie, capture validation and scene validation now ask one source-selection reader for their inputs. The reader owns the actual catalog lookups and lasts for one synchronous phase. Passing a preassembled capture or scene result would make each caller responsible for proving those facts; retaining the reader after publication would allow old metadata to hide a changed dependency. Both alternatives are avoided.

The task required consolidation but left the internal sharing interface unspecified. This choice lets future read-only owners share authoritative lookups while preserving source validation order. It adds an internal lookup object parameter to the existing resolvers, with no serialized contract, persistent cache, selected-result cache or external endpoint.

Verdict: **sound**; the two-acquisition regression proves the read bound, and mutation/order controls protect freshness and error precedence. Confidence: **high**.

### Scene status consumes clock/support facts without requesting a filename

When scene status validates a published generation, it needs the selected stream, the asset origin, the acquisition's support and the generation identity. It now gets those facts from the shared reader rather than looking up an unused media filename again. The old pathname lookup only reread an asset header; it did not open or validate a physical media file. Actual scene execution still gets its file address through the existing render selection.

The task required identical facts/output but did not prescribe the facts-versus-render structural type. Narrowing the scene descriptor to the fields it consumes avoids inventing a fake filename for read-only evidence. One clock-support helper serves both forms. This constrains future status consumers to request physical-file authority explicitly when they truly need it.

Verdict: **sound**; full scene processing/ownership/retention checks and the consumer oracle remain green. Confidence: **high**.

### Keep raw producer catalogs alongside source-pinned logs

When root independently audits the correction, a successful test summary alone cannot establish which acquisition generations or checkpoint bytes were returned. The packet therefore retains the full tiny synthetic catalog and fixture files for both producers, plus all consumer replies and runtime source pins. It leaves original scratch-path provenance in those replies rather than rewriting it to the archive's location.

The task required enough evidence for independent verification but left its packaging unspecified. Root can inspect logical state and hash every member without starting a service; these catalogs are evidence, not a deployable media library.

Verdict: **sound**; the packet has a complete member manifest and explicit producer limits. Confidence: **high**.

No needs-user or unsound choices remain. Internal names and test-observer organization were delegated discretion.
