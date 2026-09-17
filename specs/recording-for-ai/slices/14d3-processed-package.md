# 14d3 — Complete processed-package export

Status: complete no-narration packages work through CLI/MCP. Acquired narration
remains blocked on accepted transcript payloads. The native AI Package action uses
the same export owner. The [public composition proof](../assets/package-assembly/public.md)
records the current boundary.

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
Acquired narration fails explicitly until accepted transcript payloads can be
included; a readiness envelope cannot substitute for them. Video remains independent
of transcription.

## Verification and remaining gates

The actual public workflow creates through CLI, observes completion through MCP,
changes the current edit while preserving the export pin, moves the ZIP, removes
the original library, then reads new frames and audio through public clients.
The assembly evidence covers dependency retention, mutation, process crashes,
surviving native writers, private storage and cleanup. These checks use generated
no-narration media and do not establish power-loss safety or real speech fidelity.

Complete narrated export still requires slice 08. [Public timeline inspection](14c3c4-timeline-inspection.md)
is implemented. Native menu actions, transcript inspection and the installed
personal workflow remain separate acceptance gates. Keep all original release requirements in force.
