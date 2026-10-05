# 04 — Retained FFmpeg input authority

Status: implemented; focused source authority and prepared-tool receipts pass. Packaged integration remains a release gate. Question: **Can FFmpeg read only the admitted immutable local operands?**

Dependencies: [03](03-cli-lifetime.md).

## Contract and owner

Core source admission and held descriptors; service media-probe boundary and native support records.

Keep native supported input families. FFmpeg decoding does not automatically admit new project formats. Test pinned seekable fd protocol rather than treating pipe as seekable MOV. Managed work is offline and may resolve only admitted resources; refuse playlist/manifest resource graphs until each dependency is explicitly retained.

## Focused proof and review

A descriptor-read receipt with ordinary imported-footage facts.

Swap the original pathname after admission and prove held bytes remain authoritative. Test seekable MOV, selected streams, delayed audio, edit lists/B frames, VFR/final support, rotation once and unsupported surround. Test remote and secondary-local references are refused. No independently zeroed stream origins or average-fps support.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Implemented seam and focused proof

`apps/service/src/ffmpeg-input.ts` borrows an existing core read lease, native
`MediaProbe` and explicit stream ID. It never opens a source pathname. FFprobe
supplies bounded stream selector facts only, with no timing request or alternate
project admission. Numeric MOV track IDs bind directly; containers without IDs
require an unambiguous native/FFmpeg kind match. Unsupported or ambiguous streams
refuse execution; mono/stereo remain the supported audio execution boundary.
Native origin, occupied segments, final support, sample facts and transforms remain
the authority. FFmpeg receives explicit timestamp preservation and no implicit
rotation; recipe/compiler work owns any requested transformation.

Managed input permits the seekable `fd` protocol and self-contained demuxers only.
Manifest/resource graphs are refused. Every invocation owns a distinct read lease;
its explicitly named inherited source slots are rewound before execution by the
existing native CLI owner, after regular-file/read-only validation. The default
rewind set is empty, and caller descriptor indices/completion isolation remain
unchanged. This is necessary because FFprobe advances the inherited open-file
cursor: the original real MOV probe succeeded but subsequent auto-detection began
at EOF and refused valid media. A MOV-only forced demuxer workaround was rejected
in favor of this uniform held-source rule. No source pathname is reopened.

Focused evidence (2026-10-04):

- Source tests cover pathname replacement, explicit selector refusal, unsupported surround and earlier-read EOF; the EOF case failed before rewind and passes after it.
- Native topology tests refuse writable/non-regular rewind slots. Disabling the read-only guard deliberately accepts the writable case and fails its regression; the restored guard passes.
- `scripts/ffmpeg-input-probe.mjs` reuses immutable native `media.probe` replies and verifies their source SHA against retained reports. Four MOV sources/five selected streams pass bounded null decode through prepared FFprobe/FFmpeg; ordinary video/mono audio, B-frame edit-list `mediaStartUs=500000`, VFR sample durations `250000..750000`, and a quarter-turn transform remain identical to native facts. The ordinary source pathname was replaced after opening; its held original still decodes.
- Delayed audio origin/support preservation is pinned with a native-shaped `40000..1040000` segment and shared origin `-12000`; this is a metadata ownership proof, not a new physical delayed-audio render claim.
- Small real remote/local HLS probes refuse input; an HTTP canary observes zero requests. Their first refusal is nonstandard fd naming/HLS detection, with fd-only protocol and self-contained demux whitelist also enforced by the boundary. This does not claim general manifest dependency retention.

Immutable FFmpeg SHA `02121755a76faf22413c61ba9f8e9cd3e2acc14fb6e29ecc3fc0b2cc83bbcbac`.
Native authority was reused read-only from the source-probe build SHA
`af28fcc5260b79bca3909be2af1a9c90875bc3497d30d9649d3921648ef8c82d`;
its output-only probe change/private CLI additions do not invalidate retained
source facts. Ordinary source SHA
`f3b7d8f718e1724f7c22bee97419cafca0df7180ce3637eaf3fb2c19513002bd`.
Independent review found a missing CAF demuxer, reproduced with real CAF; a
regression went red before allowing CAF and green afterward. CAF and AAC now join
the existing native-supported self-contained audio families. The expanded real
receipt adds freshly native-probed 100ms CAF/ADTS AAC sine fixtures and one selected
frame of each through FFmpeg, recording generated input hashes and native facts.

The actual expanded local receipt is `/tmp/screenrec-input-proof-expanded.json`; media and
reports remain outside the repository. No user source/state or shared build was
changed. Full packaged native execution and downstream recipe geometry/timing
proof remain their owning release/recipe gates, not a claim of this seam check.

Final focused check: 26 cases across `ffmpeg-input.test.ts`, both CLI worker files
and existing `worker.test.ts`; service build/typecheck, scoped lint and diff checks
passed. Independent review's sole actionable finding (CAF coverage) is fixed and
has both red/green regression and real native/FFmpeg evidence. The larger native
renderer/publication suites were not rerun for this input-only seam.
