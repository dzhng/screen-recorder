# 14d3 — Complete processed-package export

Status: complete no-narration packages work through CLI/MCP. Narrated packages
export through the same owner: the intent pins the published transcript generation,
and a reopened ZIP answers transcript get and search page for page like the library,
including partial words after a cut. Service tests prove this with a fake transcriber;
unprepared models fail the export retryably and a failed transcript fails it
actionably. Core tests refuse tampered transcript pages on reopen. Public transcript
reads of package handles and real narration remain with slice 08. The native AI
Package action uses the same export owner. The
[public composition proof](../assets/package-assembly/public.md) records the
no-narration boundary.

## One lifecycle, two outputs

Video and processed-package requests use one
[RecordingExports owner](../../../apps/service/src/exports.ts), durable intent table
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

Narrated export evidence uses generated speech timings, not a real engine.
[Public timeline inspection](14c3c4-timeline-inspection.md)
is implemented. Native menu actions, transcript inspection and the installed
personal workflow remain separate acceptance gates. Keep all original release requirements in force.
