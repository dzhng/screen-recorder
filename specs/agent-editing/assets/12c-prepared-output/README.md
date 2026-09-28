# Retained learned output over compiled selection

Preparing the currently selected target once, then reading its retained result,
preserves the tested pure split and excludes poisoned neighbors. Native compiled
selection reproduces the frozen learned input and output exactly. A late positional
read returns only the requested bytes without invoking inference or rendering.
This is a research mechanism proof, not an implemented preparation lifecycle.

[Plan](plan.json), [report](report.json.gz) and [confirmation](verification.json)
retain the contract and measurements. The
[harness](../../../../packages/test-harness/editing/denoise-prepared-output.mjs)
uses public composition validation/edit/compiler functions and the real native
`media.mixCompositionAudio` operation. RNNoise remains an external frozen research
processor. No CLI/MCP denoise operation or authorable denoise stack is claimed.

A split at a non-RNNoise frame boundary changes neither the selected upstream PCM
nor its prepared result. Poisoning all excluded source prefix/tail samples also
changes neither. In contrast, trimming the selection requires fresh preparation:
cropping the old processed result differs at every retained sample. Gain before
RNNoise and native gain after RNNoise differ at every sample, demonstrating a
real noncommuting pair. Disabled native gain returns the dry input; this is not
a claim of a production denoise bypass operation.

The bounded read proves retrieval, not discovery or caching: the harness already
has the prepared file and uses its absolute sample offsets. It deliberately points
its inference argument at a nonexistent executable before reading. There is no
hidden prefix read, inference or upstream render in that retrieval. It does not
prove automatic dependency identity, split-aware reuse, publication fencing,
restart recovery or model-free package playback. Initial preparation covers the
explicit selected target, not the whole original source.

## What integration still needs

Core needs one **durable prepared-derivative owner shared by stretch and processors**,
scheduled by the existing job queue. The current disposable cache helper can
regenerate evicted data and is not that owner. Durable identity must include the
ordered upstream signal, retained selection, timing/rendition and pinned recipe;
new clip IDs alone cannot imply new DSP state. The resampling context helper does
not define authored DSP context. These are constraints for 14/15a, not a second
production implementation added by this experiment.

This output-target mono reproduction does not select clip-level state domains,
window transition behavior or a stereo policy. Protected speech, independent
listening, retimed/overlapping inputs and complete production-entry parity remain
open. The user's learned-filter preference remains the candidate choice.

## Reproduction and evidence

With repository dependencies installed and the existing pinned executables:

```sh
SCREENREC_NATIVE=/tmp/screenrec-border-native bun packages/test-harness/editing/denoise-prepared-output.mjs --processor /tmp/screenrec-rnnoise-api --out /tmp/denoise-prepared-fresh
```

Use a new output directory. The report records executable/harness hashes, source
revision, compiled manifests, exact commands and raw PCM identities. Identical
artifacts share one compressed file through `storedAs`; no raw gain is changed.
[Initial report](initial-report.json.gz) and [initial plan](initial-plan.json.gz)
precede the optional audition addition; confirmation preserves every numerical
comparison and raw artifact hash. The unchanged
[timing/state regression](timing-regression.json.gz) also passes. Process and
batch deadlines remain bounded; the measured short run is not a scale claim.

[Whole dry mixture](dry-mixture-whole.wav) and [whole learned output](learned-whole.wav)
are separate RMS-matched audition copies. [Dry split context](dry-mixture-split-context.wav)
and [learned split context](learned-split-context.wav) retain their corresponding
whole-copy gain. The report records gains, peaks, intervals and hashes. These
excerpts are not protected-phoneme labels; no independent listening occurred and
no audio was played automatically.

[Review](review.md) records independent code review and retained-byte verification.

The [combined-build confirmation](root-integration.json) reproduces every raw
artifact hash, comparison and bounded-read count with the integrated native
worker. It does not extend the mechanism proof to a production processor or
independent listening acceptance.
