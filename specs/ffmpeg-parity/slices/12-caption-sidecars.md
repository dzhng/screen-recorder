# 12 — Pinned SRT and VTT delivery

Status: implemented; focused proof passed. Question: **Do sidecars describe the explicitly selected displayed captions?**

Dependencies: existing contracts only.

## Contract and owner

Composition resolves cue placement; core exports/publication retain intent; protocol proposed export.create (new SRT/VTT kinds) operation.

Request revision, caption placement IDs, SRT/VTT and new destination. Resolve display text and clipped project intervals, not raw ASR. Order by exact start then stable placement ID. Round outward to milliseconds; report any added overlap. Omit nonpositive exact support, report omissions; plain sidecars discard styling explicitly. SRT/VTT escaping is format-specific.

## Focused proof and review

Tiny SRT/VTT files and parsed cue records.

Corrected display text, repeated take, fractional retime, anchors, trim, adjacent sub-ms endpoints, overlaps and escaping/newlines. Outward rounding must not create negative duration; allow genuine overlaps rather than rewriting meaning. Parse independently. Existing publication/replay/no-overwrite contract remains green.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.


## Implemented meaning and choices

`export.create` accepts `kind: "srt" | "vtt"` with explicit `revisionId` and
unique `placementIds`. The [composition serializer](../../../packages/composition/src/caption-sidecars.ts)
uses the validated graph's surviving display fragments. Core freezes the resulting
UTF-8 content and diagnostics at admission; existing export jobs, derived cache,
and native publication own delivery. Selection order is canonical for replay.
Changing the revision, selected set, format or destination conflicts with a reused
export identity. Status returns compact diagnostics, not caption text or cue bodies.

Choices made within this slice:

- Displayed corrected text is authoritative. Literal and transcript-seeded text
  share the same placement contract; no ASR or media render is invoked.
- Each positive surviving fragment becomes a cue. Exact rational boundaries remain
  in the pinned intent; millisecond start floors and end ceilings enclose support.
  Equal-start cues sort by stable placement ID, then fragment. Genuine overlaps
  remain; only newly introduced rounded overlaps are reported.
- Empty/whitespace-only text and unavailable placements are reported as omissions.
  CRLF/CR becomes LF. Controls, lone surrogates and blank payload lines refuse;
  format syntax must never silently split cues or alter literal text.
- VTT uses entity escaping for ampersands and angle brackets. SRT writes ordinary
  Unicode, comparisons and ampersands raw. Literal tags (including whitespace-prefixed tags), timestamp-shaped payload
  lines, recognized entity syntax and ASS override/escape syntax refuse with VTT guidance. FFmpeg independently
  demonstrates tags becoming formatting and SRT entities remaining literal; the
  entity refusal is a conservative cross-reader ambiguity policy, not a claim
  that FFmpeg itself decodes those entities. No invisible-character workaround.
- The caller selects captions; no title/text placement is automatically exported.
  Plain sidecars report every selected emitted placement whose styling is discarded.
- Admission bounds selection, cues, introduced-overlap reports and UTF-8 bytes.
  Exceeding a bound refuses the whole request without clipping content. Current
  values and supported payload syntax belong to the serializer, not this plan.
- The authoritative export-kind constraint includes SRT/VTT. Catalog format is 24;
  incompatible catalogs refuse without mutation. The user explicitly authorized a
  fresh catalog instead of migration. No migration shim, automatic library deletion
  or change to personal state was performed.

## Focused evidence and limits

Retained [public evidence](../evidence/caption-sidecars/report.json) includes the
actual CLI/MCP exchanges, pinned admission/replay diagnostics, delivered tiny files,
FFprobe packets and FFmpeg subtitle decode. The [SRT reader probe](../evidence/caption-sidecars/srt-reader-probes.json)
records format ambiguity separately from the passing product journey. `taken.srt`
is a deliberate foreign-file operand, not a product output. `empty.srt` is a valid
zero-byte delivery with an explicit omission report.

Reproduction (new evidence directory required):

```sh
SCREENREC_NATIVE=/path/to/screenrec-native \
  node packages/test-harness/editing/caption-sidecars.mjs --out /tmp/sidecar-proof-new
```

The proof used the unchanged HEVC build's native helper, SHA-256
`af28fcc5260b79bca3909be2af1a9c90875bc3497d30d9649d3921648ef8c82d`;
font input SHA-256
`525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9`.
It imports an explicitly selected system font into a scratch library, writes tiny
text-only captions and cleans its processes/library. No recording, speech
transcription, user-media edit or media render. Production sidecar delivery needs
no external FFmpeg; this independent verification uses FFmpeg/FFprobe only.

Focused checks passed:

- Composition caption/text files: 11 tests. Corrected Unicode, CRLF normalization,
  repeated takes, fractional retiming, content/normalized anchors, source gaps,
  trim, stable equal-start ordering, genuine versus rounded overlaps, omissions,
  format-specific escaping/refusal, timestamp-shaped payloads, whitespace-prefixed
  tags and bounded overlap diagnostics. Fault probes
  replacing fragment support, removing stable ID order and bypassing SRT refusal
  each failed for the expected reason, then passed after restoration.
- Protocol admission file: 14 tests. Sidecars require revision/unique IDs and reject
  media settings. Core catalog file: 21 tests, including byte-preserving refusal
  of format 23 and earlier/foreign formats.
- Existing project-export preservation: 6 selected tests for pinned replay,
  descriptor lease, unacknowledged commit recovery, retained staged bytes,
  concurrent identity replay and persisted-kind conflict.
- Composition/core/protocol/service builds and typechecks; changed-file lint,
  formatting and code diff-whitespace checks. Retained subtitle bytes intentionally
  end with a blank cue terminator; Git flags those media endings as blank lines at
  EOF, so their exact verified bytes are preserved.
- Public journey: independent timing/text decode, CLI/MCP, crash/edit/retry pin,
  foreign destination preservation, staging retirement and empty delivery while
  render/speech operations are deliberately unavailable.

The independent reader exposed an initially incorrect shared entity escape policy:
SRT showed the escape text literally. Format-specific serialization resolved that
failure and the complete public journey passed. No assertion was weakened.
A fixture reply barrier now tolerates the real publication call's absent signal;
held allocation proofs deliberately crash, and the shared service fixture still
bounds shutdown and kills stuck children.

This proves plain explicit subtitle delivery, not styling/burn-in, subtitle import,
automatic caption selection, general third-party reader compatibility or release
installation. The parent implementation owns the final full-system run.


Independent Codex review found two real SRT reader ambiguities: payload timestamp
lines became extra cues and whitespace-prefixed tags became formatting. Both
regressions were first observed red, then resolved by narrow format refusal with
VTT guidance. Expanded public evidence independently checks literal VTT text and
original cue timing for both. The [diagnostic timing](../evidence/caption-sidecars/srt-timing-probes.json)
and [tag probes](../evidence/caption-sidecars/srt-tag-probes.json) preserve complete
reader operands/results; these are deliberately unsafe input examples, not product
outputs. No review finding was dismissed. A broad tag candidate was narrowed after
it incorrectly refused the independently preserved comparison string; the ordinary
comparison contract and its assertion remain intact.
