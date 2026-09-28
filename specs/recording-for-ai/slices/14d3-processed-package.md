# 14d3 — Complete processed-package export

Status: complete no-narration packages work through CLI/MCP. Narrated packages
export through the same owner: the intent pins the published transcript generation,
and a reopened ZIP answers transcript get and search page for page like the library,
including partial words after a cut. Service tests prove this with a fake transcriber;
unprepared models fail the export retryably and a failed transcript fails it
actionably. Core tests refuse tampered transcript pages on reopen. Public transcript
reads accept package handles. The real-model service test exports a cut narrated take
through the CLI and reads identical transcript pages from the reopened package.
Full human-narration workflow acceptance remains with slice 15. The native AI
Package action uses the same export owner. The
[public composition proof](../assets/package-assembly/public.md) records the
no-narration boundary.

Root reading documents are implemented in the
[guide writer](../../../apps/service/src/package-guide.ts). The transcript streams
the pinned source words without applying edits, and the guide provides a short path
from reading to precise inspection. Documents have a dedicated inventory role and
only the two reserved root paths are accepted. Existing packages without documents
remain readable. On 2026-09-26, all 362 core and 109 service tests, build and type
checks passed; lint retained only the existing package-workspace warnings. A
deliberate first-page truncation failed the guide test. Native narrated and
no-narration public exports passed, including reopened inspection, retention of cut
speech in the root transcript, and valid guide links. An independent Codex review
found no actionable issues.

The rebuilt app was installed and exported this person's current recording to
`Recording 2026-09-18 at 01.40.12 - readable.zip` in Downloads. Its root contains
the guide, transcript and manifest; all 306 original transcript words match the
structured source pages, every guide link resolves, every inventory checksum and
ZIP integrity check passes, and public package admission reaches ready. The reader
was then closed. The archive adds about 5 KB over the prior export. The prior
archive remains intact. Next pickup is the remaining parent acceptance gates.

## One lifecycle, two outputs

Video and processed-package requests use one
[MediaExports owner](../../../apps/service/src/exports.ts), durable intent table
and JobQueue. The kind belongs to request identity: replay preserves it and a
changed-kind replay conflicts. Both producer dependencies are required composition;
there is no development-only unsupported-package path or third export choice.

Revision and history are pinned at request. The package consumer selects source,
scene and screenshot-index generations once, before dependent work can change the
latest selection. Their existing cleanup owners honor those pins. Waiting exports
occupy no execution lane, failed prerequisites need explicit retry, and the same
publication/recovery/abandonment owner retains external-file authority.

## Complete portable bytes

The [ZIP writer](14d3a-archive-writer.md) and
[assembly owner](14d3b-package-assembly.md) preserve original media, capture journal,
actual audio acquisition, normalized evidence, screenshot index, projected events
and history through the selected ordinal. Portable semantic pages are reread against
the pinned inputs before a manifest certifies completeness. The existing bounded
event validator checks omissions as well as row correctness.

Registered private workspaces account for assembly bytes and survive interrupted
cleanup. Native copying and ZIP writing use retained descriptors and inherited
removal locks. The destination commit never silently overwrites another file.
A committed ZIP remains successful if private cleanup needs retry; cleanup cannot
rewrite or remove that external output. The assembly slice owns the exact lifetime
and stable-private-directory boundary.

No narration is established from acquisition evidence, never a caller flag.
Acquired narration requires the pinned transcript generation. Source-transcript pages
hold words, gaps and segments in source time beside the hashed raw engine output.
Edited-transcript pages hold the pinned revision's projection for tools without the
projection owner. Package reads still project the source pages through any included
revision, as timeline evidence does. Opening therefore refuses edited pages that
differ from that projection, and source rows that disagree with the package's own
narration acquisition, ordinals or hashes. Unprepared speech models start no job, so
the export fails retryably instead of waiting on nothing. Video remains independent
of transcription.

## Verification and remaining gates

The actual public workflow creates through CLI, observes completion through MCP,
changes the current edit while preserving the export pin, moves the ZIP, removes
the original library, then reads new frames and audio through public clients.
The assembly evidence covers dependency retention, mutation, process crashes,
surviving native writers, private storage and cleanup. These checks use generated
no-narration media and do not establish power-loss safety or real speech fidelity.

The narrated service check uses a real speech engine with synthetic narration;
it establishes package fidelity to recognized words, not human-speech accuracy.
[Public timeline inspection](14c3c4-timeline-inspection.md)
is implemented. Native menu actions, transcript inspection and the installed
personal workflow remain separate acceptance gates. Keep all original release requirements in force.
