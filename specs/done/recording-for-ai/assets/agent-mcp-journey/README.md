# Actual MCP image/edit consumer

The current Codex assistant called the production stdio MCP adapter through the
official SDK, against the built native app/service and a fresh generated silent
recording. Returned image blocks were forwarded unchanged into the assistant's
image view. No personal MCP settings or client installation was modified. This
proves this SDK-to-model image path, not native connector registration in every client.

The assistant read two fresh image-only tokens, called edit.cut, inspected the
retained scene, received STALE_REVISION for an old revision, then called edit.undo
and inspected the restored scene. The [raw exchanges](mcp-exchange.jsonl) retain
actual MCP image blocks and structured responses. The [receipt](receipt.json) checks
that the tokens were absent from tool text. Private fixture truth was checked only
after the assistant recorded its image observations.

## Observed failure and correction

The [initial observation](observed.json) got the first token right but read the
second token's D as 0. Its exact hidden-truth assertion failed. The assistant then
reinspected the returned PNG, identified the D by its outline and lack of the font's
internal zero slash, and recorded a [second observation](observed-reinspection.json)
before the truth was displayed. That observation matched. The initial error is
retained: this is successful image access and editing, not perfect first-pass OCR.
The fixture's pixel font makes some glyphs confusable; no product rendering change
was made to make this probe pass.

All four images are retained: [initial](first.png), [later source](second.png),
[edited](edited.png), [restored](restored.png). The edited image bytes equal the
later source image; restored bytes equal the initial image. The [source movie](source.mov)
and [journal](source.journal.jsonl) preserve generated inputs, and the movie hash
remained unchanged. The fixture owner accepted its stop message, reaped its app and
service with no survivors, and exited zero. Its fixture home was removed after
durable evidence was retained.

As with the CLI companion, this is a bounded generated-media consumer proof.
Narration/filler editing, cursor understanding, audio audition, package exports,
physical capture and installed end-to-end acceptance remain open. No independent
fresh visual critic was available; the actual misreading and subsequent self-review
are disclosed rather than calling the general visual gate complete.
