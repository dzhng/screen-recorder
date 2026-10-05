# FFmpeg parity and agent media workflows

Completed in-tree on 2026-10-05. This record covers common offline media work
through screenrec's typed operations and consumer skill. Published release
artifacts remain owned by the existing [release workflow](../../../scripts/README.md).

The purpose is to let an agent help someone with little editing experience make
clear, polished videos from ordinary footage. The skill teaches selection,
assembly and review. The product supplies evidence and executes explicit,
non-destructive requests. It is not a replacement for a professional editing
workstation, and executable tools do not by themselves establish professional
perceptual quality.

## Why this boundary

FFmpeg fills gaps without replacing proven native paths. A single declared recipe
per capability is simpler to reason about than runtime competition between
backends: a revision must mean the same thing during inspection, preview and
export. Availability cannot silently choose a different result. Direct FFmpeg
extras remain useful without requiring a typed operation for every filter.

The app bundles pinned LGPL-compatible FFmpeg and ffprobe, including matching
sources and notices. Consumers need no separate FFmpeg install. Native Apple
encoders retain their established behavior; GPL software encoders are not part of
this build. The protected launcher carries direct media-tool execution under the
same installation lock as ordinary CLI calls, so an update cannot replace tools
while they are running. Older external launchers require the consumer guide's
explicit verified refresh.

Most workflow conveniences are task-side helpers over existing operations.
Compact transcript reading, aligned timeline inspection, review bundles, caption
proposals, selected-file preparation and editorial notes do not require another
queue, timeline interpreter or editorial database. Keeping them outside the
product's authoritative state preserves caller judgment and makes incomplete
evidence visible.

## What must remain true

- Original media stays intact. Detection, measurements and proposals never
  authorize edits. The caller chooses streams, treatments, ranges and output.
- Composition owns exact clocks, occurrences, admitted support and audio state
  domains. FFmpeg consumes selected streams or prepared samples; it does not
  reinterpret the edit graph. Missing support cannot become measured silence.
- Core owns immutable identity, retained dependencies, existing jobs and
  publication. Process exit is insufficient readiness. Managed output is
  validated in private staging before exclusive publication.
- Runtime versions and actual recipes participate in retained identity. Reads
  and retries recover their pinned evidence instead of reinterpreting it using
  the current decoder or silently selecting another backend.
- Measurement is separate from treatment. Normalization must satisfy its
  declared measurable targets before publication; impossible requests refuse.
  Lossy delivery and perceptual quality require their own observation.
- Retained speaker slots are anonymous and local to an observation. Simultaneous
  intervals retain anonymous slots during source/project projection; source reads
  and portable transfer retain every original score cell. Uncalibrated scores
  are not probabilities of a person's identity.
- Task notes and review artifacts retain exact source/revision/occurrence pins
  and disclose missing coverage. A present artifact does not imply it was watched,
  listened to or approved.

## Supported scope and deliberate limits

Core deliveries are MP4 H.264/HEVC SDR, WAV, AAC/M4A and displayed-caption
SRT/VTT. SDR correction uses the existing native picture executor. Explicit
conversion of a qualified whole HDR stream creates a managed SDR derivative
with original-source provenance and exact clock/support receipts; unknown
interpretations refuse. Range/acquisition conversion and HDR final delivery are
outside this contract.

Transparent motion is an immutable finite movie input, rather than a new
frame-sequence store. Alpha input does not promise transparent final movies.
GIF and other non-core tasks use the bundled FFmpeg passthrough; their files are
outside managed publication unless explicitly imported. GIF centisecond timing
can prevent an exact requested duration at some frame rates.

Speaker execution supports one explicitly selected complete 30-second source
channel window through the original30s recipe and requires explicitly supplied
local model/runtime inputs. Arbitrary lengths and cross-window speaker identity
are outside this contract.
Automatic distribution of that runtime is outside the product boundary here:
retained optional dependencies lack complete redistribution materials. The
fixture corpus is listed among the model's training datasets, so this bounded
reproduction does not establish training-held-out or general speaker accuracy. Existing transcript timing remains unchanged.

Fresh catalog and portable-package formats refuse older data rather than migrating
or silently deleting it. This development boundary keeps retained evidence honest.

The consumer reference retains optional 30 ms fades and 30–200 ms padding as
starting points for audition, not automatic edits or universal quality thresholds.
The user evaluates practical editing quality through product use. No demo edit,
new recording or personal-media project was performed for acceptance.

## Owners and proof

The [consumer skill](../../../skills/screenrec/SKILL.md) owns agent procedures and
progressive disclosure. [Composition](../../../packages/composition/README.md),
[Core](../../../packages/core/README.md) and
[service](../../../apps/service/README.md) own shared meaning, persistence and
execution; [protocol](../../../packages/protocol/README.md) owns public schemas.
The [FFmpeg owner](../../../helpers/ffmpeg/README.md) owns reproducible inputs and
redistribution, and the [speaker primitive](../../../helpers/speaker/README.md)
owns bounded local inference execution. [Choices](choices.md) records final
architecture decisions made while implementing the work.

Retained evidence has narrow scope; failures and unobserved perception remain
visible. Historical receipts retain their original source/runtime identities and
paths. They are observations, not a promise that every old command remains current.

| Evidence | What it establishes |
| --- | --- |
| [Build/dependency receipts](evidence/zimg-build), [tool admission](evidence/installed-tools), [input authority](evidence/input-authority) | Pinned compatible binaries, bounded readiness and source-byte authority. |
| [Audio execution](evidence/audio-integrated-checkpoint.json), [state acceptance](evidence/audio-state-acceptance/root-integration.json), [frozen recipes](evidence/audio-recipes) | Explicit dynamics, complete state-domain processing and measurable controls; no listening or general encoded-ceiling claim. |
| [Native SDR](evidence/sdr-execution/proof.json), [managed HDR](evidence/hdr-managed/README.md) | Native recipe identity and whole-stream HDR derivative publication with exact retained provenance. |
| [Motion interchange](evidence/motion-interchange/report.json), [public H.264/HEVC](evidence/hevc-public/report.json) | Finite alpha input and decoded authored clocks, audio landmarks and replay. |
| [Caption proposals](evidence/caption-proposals/report.json), [sidecars](evidence/caption-sidecars/report.json) | Explicit grouping/layout proposals and pinned displayed-caption delivery. |
| [Speaker reproduction](evidence/speaker-original/README.md), [local runtime](evidence/speaker-runtime/README.md), [source PCM](evidence/speaker-source/README.md) | Accepted bounded recipe, one local relocated execution and selected-channel PCM preparation, including the existing 48k fixture. |
| [Final local acceptance](evidence/final-acceptance/README.md) | Relocated bundled tools and managed media delivery; controlled source/project speaker reads and exact portable preservation. Full-suite and capture-environment limits remain explicit. |
| [Consumer trials](evidence/consumer-acceptance/README.md), [launcher recovery trials](evidence/consumer-launcher/README.md) | Concrete planning/schema use and requested recovery guidance; earlier failures and changed task inputs remain recorded. |
| [GIF extra](evidence/gif-extra/report.json), [direct launcher](evidence/direct-tool-launcher.json) | Small direct-tool execution, format clock limitation and lock lifetime without the production account's launcher. |

## Visual provenance

SDR comparison frames and numerical controls live in
[evidence/sdr-correction](evidence/sdr-correction); the imported reference derives
from the retained motion-interchange fixture. Alpha before/after frames in
[evidence/motion-alpha](evidence/motion-alpha) compare the same finite overlay
against known straight-RGBA still controls on dark/light backgrounds. HEVC comparison frames in
[evidence/hevc-output](evidence/hevc-output) use H.264 controls from the retained
agent-editing corpus fixtures and a synthetic B-frame control to judge orientation,
gaps and decode. Review-bundle evidence in [assets](assets) preserves controlled
headless-Chrome captures from the consumer timeline renderer, judged against
preceding captures and exact fixture intervals, including rejected framing. These are bounded visual standards, not a filmed editing demo.

## Approaches rejected

A raw filtergraph API, one command per filter, a second service timeline
interpreter and a separate job supervisor would duplicate existing owners.
Replacing native processing solely because FFmpeg is bundled would change
established behavior without evidence of improvement. Silently switching a
failed normalization mode would erase caller postconditions. Decoder inventory
alone cannot justify broader source/color admission. A runtime with incomplete
redistribution materials cannot be advertised as automatically bundled.
