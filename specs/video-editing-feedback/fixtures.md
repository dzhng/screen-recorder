# Real-video fixture contract

The user approved deriving and uploading fixtures from the SOTA/Graham Neubig editing project. This plan creates no media yet. [Source asset inventory](assets/reference-workflow/sota-graham-neubig-trailer/assets.json) supplies original byte identities; derivation must verify them against available local files.

## Owner and size

Retained regression inputs live at fixtures/video-editing-feedback/ with a README, manifest, derivation script and fixture cases. The root [fixture guide](../../fixtures/README.md) remains the owner of original/derived input conventions. Extend its links and .gitattributes when actual fixtures land.

Target approximately 250 MB total retained media derivatives stored in the repository/LFS, excluding the original multi-gigabyte recordings. Larger media use Git LFS; acquisition is case-selected. A pointer without bytes is reported missing, never passed to a decoder. A failed content-preservation reduction does not satisfy a case.

The agent may trim temporal windows and downscale full-frame video. Do not spatially crop framing, face tracking or color/crop controls. Audio reductions preserve channel selection and decoded waveform; compressed or resampled audio must be compared with the original decoder input before use in ASR/loudness regressions. Video codec, color tags, timebase, sample rate and timestamps must remain explicit.

## Proposed manifest

The derivation slice writes one machine-readable manifest with:

- case ID, purpose and stable feedback IDs;
- original source hash, stream identity and available acquisition/support;
- exact rational source ranges, per-angle offsets and original presentation timebase;
- derivative path, bytes/hash, stream metadata, codec/transform recipe and tool versions;
- original-to-derivative clock mapping, actual first/last samples and sample count;
- fixture input hash distinct from produced evidence hashes;
- original baseline receipt, derivative receipt and whether the failure survives;
- classification: real-media reproduction, independently constructed control, or historical-only case;
- expected invariant and oracle basis, without copying the tested implementation's answer.

Raw paths are input arguments/environment configuration, never hard-coded build paths. A second agent can derive the same bytes with pinned tools, or directly fetch the committed inputs and verify their hashes. Model/runtime differences produce distinct observations.

## Case selection

| Case | Source / candidate extent | What must survive |
| --- | --- | --- |
| Overlap-region | Final interview: 825–850 seconds from agent feedback; inspect original receipts for exact stream/context | Raw timing failure or a current successful regression, with offending interval diagnostics; do not infer it is still broken. |
| Tiny overlap | Madison excerpt; locate exact selection from retained original requests before derivation | 2.25-second historical failure with neighboring successful control. |
| Phrase-final trend | Final interview: contextual 1550–1576.5 seconds and boundary 1574.4–1576.4 seconds | Estimated word identity/times, energy after original cut and subsequent measured quiet. |
| Abrupt-start speech | Madison “I just” context; resolve edited-versus-raw clock from receipts | Intact/truncated/padded variants; no claim abrupt ASR alone independently labels ground truth. |
| False start | Original “fortun-” passage; locate exact source request | Audible-support evidence and recognizer omission; no invented lexical disfluency label. |
| Multicam | Graham, Madison, Lily raw session-one files | Shared content/session relationship, different single-mic streams, known offset controls and independent clocks. |
| Speaker labeling | Mixed final interview and matched raw participant excerpts spanning multiple execution windows | Speaker return/changes, simultaneous speech, slot permutations, word-crossing turns and raw mic bleed; independently assembled controls establish voice ownership without a human QA task. |
| Picture QA | White-wall Graham, taupe/backlit Madison and low-framed Lily | Face/wall appearance, edge geometry, source scale, detector misses, source-versus-delivered clipping. |
| Peaky mix | Frozen synthesis script plus actual dialogue/music selection | Historical dynamic-target undershoot if reproducible, measurable constraints and encoded peak comparison. |
| Captions/alpha | Existing overlay pattern plus short text/source fixture | Word-active timing, alpha, font coverage and phase through cut/repeat/retime. |

Candidate extents are scouting inputs. Slice 01 must certify actual support and replace unresolved selections with inspected exact ranges before declaring a corpus complete.

Add small independent controls for rational 24fps cuts, timestamp offsets/drift, unrelated audio, rotated asymmetric picture, flat patches, transparency, planted clipping/edge bars, wrong supplied text, blank detection and transition gaps. They supplement real inputs; they cannot substitute for proving real-media failures.

## Evidence placement

New reproduction results live under this spec's assets/evidence/<slice>/<case>/ or ignored owned scratch during investigation. Committed accepted reports include coverage and unavailable checks; source fixtures never contain a generated transcript implicitly labeled truth.

Historical project notes and the original session are retained as observations. A fresh pass under current Yap gets its own receipt. If the old failure is already fixed, retain the successful current case and disposition the feedback as fixed/regression-owned rather than recreating obsolete behavior.

## Derivation verdict

Acceptance requires source hashes match; expected streams/sample support exist; byte size fits the target; clock mapping is explicit; source media is unchanged; and each named case has a recorded before/after reduction verdict. The generator must preserve exact failures where possible and truthfully classify non-reproducing cases.

Compression parameters and per-case lengths are delegated to the implementing agent within this contract. The 250 MB target and full-frame/fidelity requirements are fixed by the user.
