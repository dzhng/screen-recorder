# FFmpeg parity and agent media workflows

Status: implementation active. Updated 2026-10-04.

Give a person with no editing experience an agent that can turn ordinary imported
footage into polished edits from a plain-language brief. The consumer skill teaches
the agent editorial judgment and technical setup; screenrec supplies evidence and
explicit non-destructive primitives. This is common offline workflow parity, not
every FFmpeg option or a replacement for a professional editing workstation.

## Next agent prompt

Implement the complete user-authorized plan through committed passes. Read the
[exploration map](exploration.md), [parity contract](parity.md) and
[isolated evidence](tool-proof.md). Integrated: 01–04, 06–08, 12, 20–21 and 25.
Current priority: finish managed producer 05, then
loudness 10; continue independent 09→24, caption proposals 11, SDR 16→17,
speech 22→23. HDR 18 feeds 19 through 05. Motion interchange 21 reuses existing
assets and packages; its scoped public retention proof is complete.
Each isolated worktree owns focused tests, review and choices; integration reruns
affected checks. Consumer/release acceptance 26 and the full suite remain last.

The held-input invocation rewinds explicit regular read-only descriptor slots
before exec; caller numbering stays fixed and path reopening is forbidden.
Managed FFmpeg publication reuses existing attempts/leases/cache; HDR conversion
is its first artifact consumer, while loudness remains measurement evidence.
Review helpers require caller-selected extents rather than inventing full revision
duration. Caption proposals cannot certify glyph/pixel fit before rendered proof.

Compact integration evidence: 34 portable helper checks, 18 composition settings/
caption checks, 14 protocol checks, 16 preview and 14 storage checks, two service
helper/discovery fixtures and affected builds passed. Public caption CLI/MCP
journey passed all nine groups in isolated scratch state. Native HEVC uses retained
four-source exact-window proof; full service HEVC and release ZIP remain 26.

Keep each pass to one focused contract; use write-tests before changing behavior.
Existing small fixtures are sufficient. Do not record or edit the user's media.
The first novice experience is general imported footage; the user will test the
demo after this spec, so do not run an end-to-end demo as specification work.
Viewing the new recording's pitch is still unfinished because this session could
not reach the reported running 0.1.0 app; that does not block independent slices.

Descriptor/lifetime proof, HDR/alpha feasibility and speech
quality remain research checkpoints. Failed experiments stay incomplete. No
compatibility wrappers or migrations are planned. The sole user authorized
deleting development data; new schemas use fresh catalogs and retain explicit
old-format refusal, with no automatic personal-data deletion. Update this
prompt, slice status and retained evidence before ending each implementation pass.

- [x] [01 — Pinned LGPL build](slices/01-lgpl-build.md)
- [x] [02 — Relocatable installed tools](slices/02-installed-tools.md)
- [x] [03 — Owned CLI execution](slices/03-cli-lifetime.md)
- [x] [04 — Retained FFmpeg input authority](slices/04-input-authority.md)
- [ ] [05 — Managed FFmpeg publication](slices/05-managed-output.md)
- [x] [06 — Bounded selected-file preparation](slices/06-batch-preparation.md)
- [x] [07 — Compact transcript reading](slices/07-compact-transcripts.md)
- [x] [08 — Aligned timeline inspection](slices/08-timeline-inspection.md)
- [ ] [09 — Read-only revision review bundle](slices/09-review-bundle.md)
- [ ] [10 — Read-only loudness measurement](slices/10-loudness.md)
- [ ] [11 — Caption grouping and layout proposals](slices/11-caption-proposals.md)
- [x] [12 — Pinned SRT and VTT delivery](slices/12-caption-sidecars.md)
- [ ] [13a — Normalization reproduction](slices/13a-normalization-reproduction.md)
- [ ] [14a — Limiter reproduction](slices/14a-limiter-reproduction.md)
- [ ] [15a — Compressor reproduction](slices/15a-compressor-reproduction.md)
- [ ] [13 — Explicit normalization](slices/13-normalization.md)
- [ ] [14 — Explicit limiter](slices/14-limiter.md)
- [ ] [15 — Explicit compressor and ducking](slices/15-sidechain.md)
- [ ] [16 — SDR correction reproduction](slices/16-sdr-feasibility.md)
- [ ] [17 — Typed SDR correction](slices/17-sdr-grade.md)
- [ ] [18 — HDR-to-SDR reproduction](slices/18-hdr-feasibility.md)
- [ ] [19 — Explicit HDR source conversion](slices/19-hdr-conversion.md)
- [x] [20 — Transparent motion input feasibility](slices/20-alpha-feasibility.md)
- [x] [21 — Immutable motion-asset interchange](slices/21-motion-import.md)
- [ ] [22 — Local speech evidence feasibility](slices/22-speech-feasibility.md)
- [ ] [23 — Validated optional speech evidence](slices/23-speech-evidence.md)
- [ ] [24 — Portable task-side editorial notes](slices/24-editorial-notes.md)
- [x] [25 — Everyday typed HEVC delivery](slices/25-hevc-output.md)
- [ ] [26 — Consumer skill and release acceptance](slices/26-consumer-release.md)

## Contracts and ownership

- **Composition owns meaning:** exact rational source/project clocks, admitted
  support, occurrences, ordered processors, curves and state domains. FFmpeg
  consumes explicit selections or prepared samples, never a second EDL. Off-grid
  previews preserve absolute sample phase; rotation happens once.
- **Core owns identity and lifetime:** immutable sources, optional evidence,
  models, revisions, jobs, preparation, attempts and publication. Managed FFmpeg
  output uses private staging and exclusive publication. Process exit is not
  readiness. No new queue, revision store or notes catalog.
- **Service owns execution composition:** extend its existing worker lifetime
  for CLI protocols. Do not drop raw FFmpeg into JSON decoding or create a
  daemon/supervisor/router. Parent death/cancel must retire all descendants.
- **Protocol owns public contracts:** CLI/MCP/app share schemas and meaning.
  Proposed operation names in slices are not shipped commands. Capability
  admission and actual executable readiness remain distinct.
- **Release owns bundled inputs:** pinned FFmpeg plus ffprobe, dependency closure,
  matching sources, notices, signatures and relocation proof. Consumer-facing
  absolute executable paths come from the selected app, never PATH guesses.
- **Consumer helpers own conveniences:** selected-file batch preparation, compact
  reading, timeline/review artifacts, cue proposals and task-side notes reuse
  existing operations. Promote a helper only when demonstrated shared delivery
  or retention needs justify it; do not duplicate timing/evidence calculations.

One tested default per capability preserves proven native behavior and uses
FFmpeg for gaps. Record implementation/version/configuration and dependencies.
The same pinned processing recipe governs inspection, preview and export. A
missing recipe refuses; no silent result-changing substitution. Backend policy
alone proves neither fewer bugs nor faster execution; measure startup, decode,
intermediate transfers and representative work before performance claims.

## Delivery and direct extras

Core delivery: **MP4 H.264/HEVC SDR, WAV, AAC/M4A and SRT/VTT**. Preserve native
H.264/WAV/M4A and prefer native HEVC if its focused proof passes. Explicit
HDR-source-to-SDR conversion creates a managed derivative; HDR export is deferred.

Bundle a broad LGPL-compatible build from pinned sources with Apple encoders.
GPL/nonfree components are excluded; compatible workflows do not depend on
familiar GPL filter names. External dependencies are added only when required
and verified. The local GPL Homebrew binary is reference evidence, not release input.

Consumers need no separate FFmpeg install after this bundle ships. Today supported
screenrec operations already execute natively and do not need consumer FFmpeg.
After packaged proof, the skill gets one simple line:

> For extra media tasks outside screenrec’s core operations, use bundled FFmpeg
> at the installed path returned by tool discovery; check its filters and codecs.

Direct extras such as GIF are standalone outputs. Ordinary import and explicit
placement bring them into projects. A direct file never silently satisfies a
failed managed export. No wrapper operation per FFmpeg filter is planned.

Deferred core formats: ProRes/MOV, transparent final movies, WebM, MP3/FLAC and
HDR delivery. Also deferred: editing UI, bundled browser/animation engines, hosted
speech, cross-platform runtime and automatic editorial policy. Extra binary
capabilities do not become core support just because inventory lists them.

## Slice graph and review

Foundation: 01 → 02 and 03 → 04 → 05. Workflow helpers can ship independently.
Measurement precedes independent 13a/14a/15a recipe reproductions and then the corresponding explicit treatments. Feasibility must precede color,
HDR, alpha and speech implementation. The final consumer/release gate joins all
accepted branches. Dependencies order checks, not simultaneous expensive work. A FFmpeg alternative selected for grade or HEVC adds 01–05 as conditional prerequisites. A new HDR dependency reopens the frozen build and its affected proofs. Speech research/implementation tracks each family separately and reslices the implementation placeholder before pickup.

| Slice | Contract | Dependencies |
| --- | --- | --- |
| 01 | [Pinned LGPL build](slices/01-lgpl-build.md) | existing owners |
| 02 | [Relocatable installed tools](slices/02-installed-tools.md) | 1, 3 |
| 03 | [Owned CLI execution](slices/03-cli-lifetime.md) | 1 |
| 04 | [Retained FFmpeg input authority](slices/04-input-authority.md) | 3 |
| 05 | [Managed FFmpeg publication](slices/05-managed-output.md) | 3, 4 |
| 06 | [Bounded selected-file preparation](slices/06-batch-preparation.md) | existing owners |
| 07 | [Compact transcript reading](slices/07-compact-transcripts.md) | existing owners |
| 08 | [Aligned timeline inspection](slices/08-timeline-inspection.md) | 7 |
| 09 | [Read-only revision review bundle](slices/09-review-bundle.md) | 8 |
| 10 | [Read-only loudness measurement](slices/10-loudness.md) | 5 |
| 11 | [Caption grouping and layout proposals](slices/11-caption-proposals.md) | 7 |
| 12 | [Pinned SRT and VTT delivery](slices/12-caption-sidecars.md) | existing owners |
| 13a / 14a / 15a | [Audio recipe reproductions](slices/13a-normalization-reproduction.md), [limiter](slices/14a-limiter-reproduction.md), [compressor](slices/15a-compressor-reproduction.md) | 10 |
| 13 | [Explicit normalization](slices/13-normalization.md) | 13a |
| 14 | [Explicit limiter](slices/14-limiter.md) | 14a |
| 15 | [Explicit compressor and ducking](slices/15-sidechain.md) | 15a |
| 16 | [SDR correction reproduction](slices/16-sdr-feasibility.md) | existing owners |
| 17 | [Typed SDR correction](slices/17-sdr-grade.md) | 16 |
| 18 | [HDR-to-SDR reproduction](slices/18-hdr-feasibility.md) | 1, 4 |
| 19 | [Explicit HDR source conversion](slices/19-hdr-conversion.md) | 18, 5 |
| 20 | [Transparent motion input feasibility](slices/20-alpha-feasibility.md) | existing owners |
| 21 | [Immutable motion-asset interchange](slices/21-motion-import.md) | 20 |
| 22 | [Local speech evidence feasibility](slices/22-speech-feasibility.md) | existing owners |
| 23 | [Validated optional speech evidence](slices/23-speech-evidence.md) | 22 |
| 24 | [Portable task-side editorial notes](slices/24-editorial-notes.md) | 9 |
| 25 | [Everyday typed HEVC delivery](slices/25-hevc-output.md) | existing owners |
| 26 | [Consumer skill and release acceptance](slices/26-consumer-release.md) | 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 24, 25 |

[Roadmap](visualizations/roadmap.html) gives a compact branch view. The
[workflow example](workflow-example.md) is the future consumer acceptance target,
not an executed edit. All eleven capability additions are mapped in
[parity](parity.md); this is their sole implementation ladder.

For each slice, run the narrowest test/fixture that answers its question. Run
everything once when implementation finishes. For visual output, retain a small
control/candidate pair and named crop/variable, compare-screenshots, show through
preview-shots, then run unprimed screenshot-critique as the final visual check.
Human response is non-blocking for reversible appearance decisions; record the
evidence-based verdict after a short review opportunity. Audio quality claims
require listening, not metering alone. Missing viewing/listening stays explicit.

## Delegated choices and synthesis

The user selected scope, everyday delivery, tested defaults and broad LGPL bundling,
and delegated matching planning choices based on simplicity, proven implementations
and bundled tools. Answered by the agent on their behalf: existing review surfaces,
Apple Silicon/macOS 26+, fresh development schemas without migration or automatic deletion, task-side notes,
helpers for orchestration, native-first HEVC/SDR correction, explicit HDR derivative,
and refusal rather than silent linear-normalization fallback. These are reversible
planning choices within the given preferences, not permission to implement.
The user superseded the initial narrated-screen-first proposal with imported footage
and explicitly removed the demo edit from this planning pass.

Independent fewest-slices, risk-first, seam-quality and operator-simplicity drafts
were synthesized, including a separate Claude consultation.
They agreed on existing ownership, helper reuse, feasibility gates and keeping
measurement separate from treatment. The compact draft grouped runtime and audio
work broadly; this plan splits build, lifetime, authority, publication and the
three dynamics contracts because each has a different failure oracle. It does
not add new layers to do so. Native-first execution avoids moving proven paths
merely because a bundle exists. The alternative of new service operations for
all inspection conveniences was rejected in favor of helpers over shared existing
contracts; no demonstrated retention requirement yet justifies more public surface.
A new sidecar operation was consolidated into the existing export.create owner.
Research checkpoints freeze remaining measured
decisions before dependent work; naming/decomposition and bounded fixture choice
remain delegated.
