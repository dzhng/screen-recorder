# 20d8 — Prerecorded pause and terminal persistence boundaries

Status: verified scoped prerecorded checkpoint. Dependencies: [20d7](20d7-terminal-diagnostics.md).

## Contract

Actual prerecorded capture callbacks preserve both audio roles across a pause.
Canonical output retains exactly the accepted samples and removes exactly the
observed pause from source placement. Normal publication and recovery agree.

Once canonical media and its receipts are durable, absence or a torn write of the
terminal journal record cannot erase playable media or manufacture a completed
capture. Recovery preserves the original files and public recording reads remain
truthfully interrupted across service restart.

## Owner and verification

Extend the existing native prerecorded input/publication probe. Only physical
input is substituted; the production writer, journal, publisher and recovery stay
in use. The pause oracle uses offered decoded buffers and recorded host boundaries,
independently assembling accepted PCM and source-support digests. Terminal fixtures
copy a verified take and remove only its terminal suffix; they model durable
filesystem boundaries, not a process-kill or hardware power-loss experiment.

The [public journey](../../../packages/test-harness/editing/capture-terminal-boundaries.mjs)
uses the full service with an idle desktop control peer, actual native recovery,
CLI/MCP inspection and restart. [Evidence](../assets/20d8-pause-terminal-boundaries/README.md)
retains scope and findings. Physical20/21 remain separate.
