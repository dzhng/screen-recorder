# Independent public CLI usability review
Result: tested workflow passed; no demonstrated defect. This is behavior evidence, not a code-diff correctness audit.

## Exact actions
All service calls used bun /Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js OP --socket /tmp/sr-font-skill-KeQdMX/library/run/service.sock --params -, with saved JSON on stdin. Delivery added --output PATH. actions.jsonl records commands/exit codes; *.request.json and *.receipt.json preserve every attempt.

1. Read skills/screenrec/SKILL.md; discover --help, extracting public operation schemas. Read processing.capabilities (geometry execution available).
2. asset.import /System/Library/Fonts/Supplemental/Arial Bold.ttf, requestId fresh-caption-font-1; job.get became ready; asset.get returned exact face Arial-BoldMT, no media streams.
3. project.create, requestId fresh-caption-project-1: title Fresh literal caption review; 640x360, 30/1 fps, opaque #142032ff.
4. edit.apply, requestId fresh-caption-place-1: video track order 0; project-anchored text [0,3000000) us; literal "Literal captions\nMade for agents" (actual newline); admitted Arial-BoldMT; source 560x160, size 36, #ffd166ff, center, wrap true. Explicit enabled geometry during [0,3000000): full source crop (0,0,560,160); rect (40,100,560,160); contain; scale (1,1); rotation 0; pivot (.5,.5).
5. frame.get pinned revision at 1000000 us, maxLongEdge 640, processed output tap: processing then ready; delivered before.png. Personally inspected actual pixels: two complete gold bold lines, horizontally centered, legible against navy, no apparent clipping. Layout returned both lines and only Arial-BoldMT.
6. edit.apply text.set, requestId fresh-caption-set-1: "Edited literal\nStyle changed", same font and box, size 44, #63e6beff, left, wrap false. Returned ordinal 2; placement and processing remained identical.
7. Pinned frame.get with same inspection settings: processing then ready; delivered after.png. Personally inspected pixels: correct changed two-line literal, larger mint-green bold text, left aligned at x=40; no apparent clipping. Layout echoed the new text and correct face. PNG bytes differ.
8. Replayed identical text.set request including original expectedRevisionId and requestId: success, full data exactly equal to first receipt, same revision and ordinal; no duplicate edit.
9. text.set with exact-face name Not-An-Admitted-Face: refused with INVALID_EDIT / Unknown exact font face, cause INVALID_COMPOSITION.
10. text.set literal "Unsupported 🦄" with admitted Arial-BoldMT: authoring accepted as ordinal 3; pinned frame.get transitioned processing -> failed, reason FONT_SUBSTITUTED: AppleColorEmoji, retryable false, no published frame/delivery. No silently substituted PNG.
11. project.get confirmed head at ordinal-3 revision. Left this intentional unsupported-glyph probe in the isolated project; valid before/after revisions remain pinned in receipts.

## Discovery and limits
Skill plus JSON schemas were sufficient without implementation, tests, or spec reports. Help is bulky: nested geometry/curve unions caused tool-output truncation; programmatically selecting schemas/fields resolved this. Geometry requires deliberate extra processing to avoid scaling the font box; the skill clearly warns about it. Font-face refusal occurs at edit time but glyph/fallback refusal occurs only during rendering. A failed frame still returns CLI exit 0 and ok:true; agents must inspect data.state/reason, not only exit status.

Verified only this local Bold TTF, two short ASCII/newline literals, one time sample each, explicit opaque canvas, exact-face error and emoji fallback refusal. Did not establish automatic wrapping/overflow behavior, exact colorimetric fidelity, other scripts/fonts/collections, transparency, video export, structural edits, relocation, or concurrent-writer behavior. No repository edits/rebuilds, installed-app/user-library operations, or service shutdown. Local scratch is confined to this directory; mutations occurred only through the provided isolated service.
