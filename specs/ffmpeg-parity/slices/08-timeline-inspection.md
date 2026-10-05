# 08 — Aligned timeline inspection

Status: implemented; focused contract checks and scoped visual acceptance passed. Question: **Do pictures, words, per-channel waveforms and cuts share a truthful axis?**

Dependencies: [07](07-compact-transcripts.md).

## Contract and owner

Consumer helper assembles existing inspectors; composition owns all clock projection.

Source or pinned revision/window plus frame/pixel/bucket/text budgets returns image and exact manifest. Describe visible sample support, gaps, unavailable evidence and cuts. No second timestamp projection or full scan disguised as a thumbnail.

The [consumer helper](../../../skills/screenrec/scripts/timeline-inspection.mjs)
returns a portable SVG sheet and exact JSON manifest for one explicit bounded
window. Its executable help owns request budgets. Project frames retain compiled
visible support; source pictures distinguish requested and decoded times and retain
their raw physical sample receipt without inventing an inverse projection.
Words keep the transcript owner's fragments and occurrence IDs, and waveform
channels keep the audio owner's absolute sample clock. Display rounding never
feeds an edit. Simultaneous events receive independent labels.

The helper reads only CLI-delivered task files, never a service-internal cache
path. The shared [artifact helper](../../../skills/screenrec/scripts/inspection-artifacts.mjs)
owns bounded file reads and the existing consumer stdin/envelope procedure;
compact transcripts reuse that procedure. Requested frame/waveform/scene reads
may prepare their ordinary derivatives. Transcript reads use `prepare:false`;
there are no edits, model downloads or implicit failed-work retries. Event pages
retain preparation diagnostics and job identities for caller-directed recovery.

## Focused proof and review

One small filmstrip/waveform/word/cut sheet.

Test source/project clocks, repeated occurrence, off-grid start, VFR, stereo and acquisition gaps. Compare coordinates to owner-produced intervals. Measure decode/seek work and impose bounds. Judge axis/label legibility across the whole sheet; unrelated color aesthetics are out of scope.

Focused proof: `node --test scripts/timeline-inspection.test.mjs
scripts/compact-transcripts.test.mjs scripts/consumer-cli.test.mjs` passes the
timeline, existing reading-artifact and shared subprocess contracts. Red/green
covered absent implementation, total event pagination admission and lost event
dependency diagnostics. The executable helper also consumes bounded stdin and
uses the selected installed CLI.

The [service fixture](../../../apps/service/src/timeline-helper.test.ts) executes
actual selected-source operations and delivered PNG bytes across the public
socket. It observes one reader and one decoded sample for an off-grid VFR query;
an explicit physical gap performs no decode. It uses an isolated library and a
controlled native receipt, so this proves orchestration and admission rather than
native decode quality. Standalone project fixtures retain exact rational fragments,
repeated occurrences, separate stereo channels and cut coordinates. All source
and project request forms also pass the current production operation schema.
No user media, installed app, model or native build was used.

Independent Codex review found lost scene-job diagnostics in pending event reads;
the regression now proves those identities survive. Strict no-emit fixture type
checking, formatting, lint and whitespace checks passed. Visual comparison uses
controlled pixel placeholders to judge the shared axis and labels, not picture
quality. The first sheet collapsed simultaneous cut labels; the candidate gives
them separate rows. Fresh critique then found weak markers, duplicate field
labels and unclear picture/request association. The next candidate uses bounded
picture cards with direct request connectors, stronger ticks and adjacent
deduplicated event labels. Its exact fixture manifest is unchanged; the time axis
is pixel-identical, and waveform/word panels retain their horizontal geometry
after the declared picture-section height increase. A second fresh critique and
root inspection found that distant word labels needed clearer row association.
The next candidate adds neutral row guides behind the unchanged bars and labels;
the legend explicitly distinguishes guides from media support. Its manifest and
all existing rectangle geometry are unchanged, and pixel changes stay within the
word section. Final fresh critique found no blocking issue and accepted the row
association. The [retained evidence](../assets/08-timeline/README.md) owns the
comparison and verdict. Visual proof is scoped to the sparse controlled sheet at 1200 pixels
wide; crowded long labels and smaller viewports have not been visually proven.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
