# 00b — Real-agent image access

Status: complete. See [actual-agent evidence](../assets/client-image/review.md). Dependencies: 00 bootstrap. This gate may remain pending while independent native, speech, and timeline slices proceed. It is required by slice 12 and final acceptance.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

A real local agent can receive fixture pixels through MCP and open a CLI-produced image before the product invests in full media plumbing.

Using the workspace and envelopes from slice 00, implement a development-only
fixture-image MCP tool and CLI path response. These are not production recording
operations. Use the pinned official SDK and isolated client configuration.

## Runnable checkpoint

Run bun run lab:client-image. Launch the installed Claude Code CLI in an isolated session with session-scoped MCP configuration. Return a generated visual token in actual image content, ask the agent to report it, then request a second image. Repeat through a CLI-created file and the client's image-reading tool. Retain client/version and exchange. The token must not be in text/filename/prompt. No mutation of personal AI settings.

## Acceptance

Both agent image paths are proved with fixture pixels. JSON schema/tool previews alone fail this gate. A missing client login/permission is explicitly pending, not compatible by assumption.

## Decisions delegated and scope firewall

Temporary image tool is removed as a public operation once slice 12 provides real frames; keep its fixture in test-harness. Output formatting and probe internals may be chosen locally; actual pixel ingestion through both paths is fixed.

## Visual review

Image visibility only; fixture typography or visual branding is out of scope. Crop the changing token. Use screenshot-critique last; compare-screenshots against the generated source image before that.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If image delivery is unsupported, try a client-supported actual image representation within MCP, or document a client limitation and seek another concrete client. Do not replace images with path strings and declare success.

