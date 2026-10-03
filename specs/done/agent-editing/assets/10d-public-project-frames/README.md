# Public project pictures

The [live journey](../../../../../packages/test-harness/editing/frame-evidence.mjs)
runs real CLI/MCP requests against a scratch service and frozen native worker.
Its independent corpus labels verify repeated, held, partial and empty pictures.
CLI files and MCP inline images agree byte for byte. Revision pinning survives
restart and head edits; mixed batches retain duplicates and per-item errors;
cancellation permits retry. Unavailable audio retiming does not block stills.

After deleting the original project, a new project renders both retained assets
with the original PNG hashes and independently expected labels. This resolves
the independent review's finding that catalog rows alone did not prove retained
media. Removing scratch owned-media files after deletion makes this exact gate
fail (`deletion-mutation.json`); the restored journey passes. The focused
follow-up review found no actionable defect. Source selectors, screenshot indexes, public acquisition masks and fresh
visual review of these public artifacts remain separate gates.

`report.json` records the actual frame journey and frozen native hash.
`source-audio-integration.json` retains the combined-runtime 1.15 GB source WAV
journey, including complete streaming, exact sample counts and bounded AAC
comparison. `preview-integration.json` and `preview-visual-identity.json` retain
preview/export preservation: all 19 images match the reviewed baseline exactly.
Focused service/CLI/type and actual native render-lifetime logs are retained.
These results do not establish listening quality, new visual styling, broad
codec quality or completion of the full inspection slice.

Run after dependency builds:

```sh
SCREENREC_NATIVE=/path/to/frozen/screenrec-native node packages/test-harness/editing/frame-evidence.mjs --out /tmp/project-frame-journey
```
