# Verification and review contract

This document defines release gates. The [main handoff](README.md#next-agent-prompt)
and owning slices track which checks have actual evidence; an uncompleted gate
is a requirement, not a claim about the current implementation.

## Fixtures and provenance

Run `bun run lab:workbench` for the local fixture website in `apps/workbench`.
Its [browser review evidence](assets/workbench/review.md) covers the test surface;
recording acceptance still requires capture of that surface. It has an asymmetric labeled
grid, submenu bug, long scroll section, changing visual token, and optional audio
tones. Tokens used to prove actual image visibility are not copied into transcript,
tool text, filenames, prompts, or hidden fixture metadata given to the agent.

`packages/test-harness` generates numbered/timestamped media with separate labeled
tracks and retains real narrated captures. Synthetic media validates mechanics;
real human narration validates speech models. Never substitute TTS for a claim
about David's disfluencies. If no real narration fixture exists, let the recording
probe collect one when the user is available; mark that gate pending and continue
independent slices. Do not secretly record the user or microphone during planning.

Keep feature-owned fixture manifests, measurements, shots, and agent transcripts
under `specs/recording-for-ai/assets/`. Each result records command, revision,
tool/model version, hardware, inputs, output, pass/fail and any unavailable case.
Synthetic values are labeled. Do not claim actual second-display coverage from
coordinate math alone when no second display was tested.

## Tests by seam

- Protocol: malformed input, CLI/MCP registry coverage, native wire round trips.
- Timeline: independently stated expected intervals/durations for cuts and trims,
  repeated undo, stale edits, mid-word fragments, pause/cut events, endpoint frames.
  Exercise behavior rather than mirroring implementation calculations.
- Native capture: permissions, source types, independent audio, moved/resized windows,
  cursor geometry, pause alignment, source loss, abrupt process termination.
- Storage/jobs: real SQLite transactions and processes; kill/restart/late completion,
  delete while busy, retry after lost response, no old artifact labeled current.
- Media: decode outputs and audition joins; success exit status alone doesn't pass.
- AI: real client image reading followed by the actual read→cut→inspect→undo loop.
- Package: move output, hide original library, then decode a previously unselected
  timestamp through the package reader and inspect it via MCP/CLI.

Use the write-tests skill for implementation tests; mocks belong at external
boundaries. A real native capture test cannot be replaced by a mocked stream.

## Visual gates

Every visual slice must run an unprimed
[screenshot-critique](/Users/david/.agents/skills/screenshot-critique/SKILL.md)
as the last check before accepting its shots. Where a reference/prior shot exists,
first run [compare-screenshots](/Users/david/.agents/skills/compare-screenshots/SKILL.md)
with the slice's crop/mask and variable. Retain results with the shots. Automated
tests do not substitute for this review.

Open evidence for the user with
[preview-shots](/Users/david/.agents/skills/preview-shots/SKILL.md). Review checkpoints
are non-blocking for reversible implementation choices: allow about five minutes
while doing independent work; if no reaction, decide from the evidence, document
the decision, close the shots, and proceed. This never authorizes recording,
permissions, paid model licenses, or abandoning required fidelity without user input.

## Performance and fidelity targets

These are deliberately chosen initial gates, not guarantees on arbitrary media:

- Capture: 30 fps target, SDR, preserve text readability at the 4096-pixel capture
  ceiling; record dropped-frame statistics rather than hiding stalls.
- Native cursor placement: maximum 3 output pixels error on the asymmetric grid
  at the tested scale. Preserve rapid circle/wave shape at 60 Hz sampling target.
- A/V/timeline: ≤50 ms drift on a five-minute fixture with pauses; frame lookups
  within one available capture frame and never across a deleted span.
- Recovery: validate claimed playable prefix; target no more than 5 seconds loss
  after the first committed checkpoint. A kill before any checkpoint may recover
  zero, which must be reported. No power-loss claim without corresponding testing.
- Speech: all deliberate fillers/repetitions in the canonical short edit fixture;
  held-out set at least 40 labeled fillers across real clips, ≥95% filler precision
  and recall, median boundary error ≤100 ms/p95 ≤250 ms. Audition phrase/filler cuts
  for clipped neighboring words. Report denominators and uncertainty; do not claim
  universal accuracy from this small acceptance set.
- Speech resources: warm five-minute clip no slower than real time, peak process
  RSS target ≤4 GiB on this host; prefer faster/lighter only among fidelity passers.
  If targets conflict, reslice/measure the alternative; do not quietly drop fillers.
- Long inspection: use a 30-minute fixture; page extraction doesn't load all images
  or decode entire video per request. Repeat the same frame and observe a cache
  hit. Record RSS vs duration and cache eviction with unchanged source hashes.

## Expected command surfaces

Bootstrap defines `bun run build`, `check-types`, `lint`, `format:check`, and `test`.
`build` orchestrates TS and Swift and fails when a required native build fails.
Vitest targets individual package files; Swift tests use the owning package.
`bun run lab:<slice-name>` commands described in slices are planned interfaces,
not commands claimed to exist now. They belong to test-harness, forwarded at root.

Run narrow tests while iterating. Once at release closeout, run build, formatting,
lint, type checks, TS/native tests, and the installed journey. Repeat only if a
subsequent change or failure warrants it. No speculative Docker/cross-platform
suite for this Mac-only native product.

## Final acceptance

From the installed local app/CLI outside the checkout: record localhost narration
with cursor emphasis, optional browser audio, a pause, a filler and the phrase
"this is free". Show processing status immediately. The external AI reads the
transcript/index, sees returned images, fetches another frame, identifies the phrase
and filler, submits revision-bound cuts, previews/listens, encounters a stale edit,
and undoes. Export both choices, move/reopen the package, request a new timestamp.
Also demonstrate interrupted recovery, failed transcription retry, disk accounting,
and deletion without recreating artifacts. No app implementation is complete until
this journey has real evidence or explicitly reported unresolved user-dependent gates.
