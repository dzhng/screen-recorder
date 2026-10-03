# Explicit denoise strength and transitions

`mix` is an ordinary bounded scalar control on the existing learned processor.
It blends the exact ordered upstream signal with latency-aligned learned output.
Zero values preserve that upstream signal but leave learned state running. Each
prepared span contains the complete mixed step result, so later processing and
prefix reuse have one meaning. The existing scalar compiler owns clocks,
restriction and curves; the frozen learned adapter retains its policy.

The extended public denoise journey retains its default gates and adds complete
independent stereo comparisons for held, linear and cubic mix envelopes. The
reference uses the pinned C adapter and explicitly evaluated fixture envelopes;
it does not call the production curve compiler. It covers exact dry/full-wet
endpoints, explicit1 versus omitted result-byte equality with distinct recipes,
window dry neighbors, full/range reads, plateau-crossing split, move/trim,
combined parent routing, two learned steps separated by gain, reorder, bypass,
history and undo. Wrong phase, wrong order and resetting learned state after a
zero plateau produce distinct references. Mixed preview and movie export use
the actual public/native paths; no lossless-versus-AAC equality is claimed.

Original v8 preparations from the retained small package also pass actual adoption
into the v9/v19 service, historical full PCM reads, preview/export and undo while
learned capability is unavailable. This verifies policy-bound retention across
the produced-executor change, independently of newly prepared mix results.
No frozen v8 evidence was rewritten.

The initial schema test rejects the unimplemented field, then passes with bounded
curves and rejects overshoot. All composition tests, focused prepared/audio/preview
consumer tests and native-enabled project audio checks pass. Independent Codex
review found no actionable regressions and reran composition tests/types; its
sandbox prevented native compilation, which the local build and public runs
separately verify. Review of the final harness also checks explicit window
neighbors and produced recipe identity.

Two old fixture assumptions surfaced during the expanded journey. Scratch homes
must use the canonical path because retained reads reject symlinked ancestors.
Already prepared output remains readable without its processor; the refusal
control now authors a genuinely unprepared changed mix. The original refusal
and retained-asset coverage remains, followed by a separate phase allowing the
native retained-PCM reader while denying learned capability. Red logs retain
these harness failures without calling them product defects.

The complete report, native outputs and independent reference files are stored
losslessly in the evidence archive. [Verification metadata](verification.json) authenticates that
archive and names its scope. No device, playback, download, retiming enablement
or subjective quality assessment occurred. Parent denoise/speech and editor
acceptance remain open.

[Combined-root verification](root-verification.json) repeats all50 public checks
with the merged native worker and passes244 composition plus31 native audio and
preparation tests. Fresh product-skill validation is tracked separately.
