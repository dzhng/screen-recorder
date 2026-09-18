# Verification and review contract

This document defines release gates. The [main handoff](README.md#next-agent-prompt)
and owning slices track which checks have actual evidence; an uncompleted gate
is a requirement, not a claim about the current implementation.

## Fixtures and provenance

Run `bun run lab:workbench` for the local fixture website in `apps/workbench`.
Its [browser review evidence](assets/workbench/review.md) covers the test surface;
recording acceptance still requires capture of that surface. [Its page](../../apps/workbench/public/index.html) owns the
fixture set. Tokens used to prove actual image visibility are not copied into transcript,
tool text, filenames, prompts, or hidden fixture metadata given to the agent.

Generated fixtures produce numbered/timestamped media with separate labeled tracks;
real narrated captures are retained as evidence. Synthetic media validates mechanics;
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
[screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md)
as the last check before accepting its shots. Where a reference/prior shot exists,
first run [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md)
with the slice's crop/mask and variable. Retain results with the shots. Automated
tests do not substitute for this review.

Open evidence for the user with
[preview-shots](../../.agents/skills/preview-shots/SKILL.md). Review checkpoints
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
- Speech: on real narration, median word boundary error ≤100 ms/p95 ≤250 ms, and
  audition phrase cuts for clipped neighboring words. **Measured 2026-09-19 and not met:**
  median 135 ms, p95 590 ms, with every boundary outside the speech rather than inside it, so
  cuts keep their neighbours whole. Kept as a reported miss rather than a relaxed target; the
  [evidence](assets/speech/boundaries/README.md) says what remains and why tightening it would
  have to guess. Filler precision/recall is
  reported with denominators but is not a gate (user decision 2026-09-17). Do not
  claim universal accuracy from this small acceptance set.
- Speech resources: warm five-minute clip no slower than real time, peak process
  RSS target ≤4 GiB on this host — **met 2026-09-19**: 0.004x real time and 147 MB peak over
  6 min 42 s of this person's own narration; prefer faster/lighter only among fidelity passers.
  If targets conflict, reslice and measure the alternative.
- Long inspection: use a 30-minute fixture; page extraction doesn't load all images
  or decode entire video per request. Repeat the same frame and observe a cache
  hit. Record RSS vs duration and cache eviction with unchanged source hashes.

## Expected command surfaces

Bootstrap defines `bun run build`, `check-types`, `lint`, `format:check`, and `test`.
`build` orchestrates TS and Swift and fails when a required native build fails.

Tests live beside the code they exercise, and the file name decides whether the
default suite runs them. `bun run test` runs Vitest `*.test.ts` files in the
TypeScript packages, and the `apps/macos` suite runs the Swift test executables plus
`node --test` over `*.test.mjs` in `apps/macos/tests` and `helpers/mac/Tests`. A bare
`.mjs` beside those suites, or in `apps/service/tests`, is an opt-in lab: it needs a
fresh bundle, a selected native build, a long workload or recorded evidence, so the
default suite never runs it. `lab:*` scripts in the root manifest or
`packages/test-harness` are the entrypoints; a lab without a script documents its command in
its evidence README. `bun run lab:exports` builds a fresh bundle, then runs the
package/export labs through the [test-harness runner](../../packages/test-harness/package-exports.mjs);
a passing run does not close the still-unimplemented package, speech or
installed-workflow requirements. `bun run lab:<slice-name>` commands that slices
describe without a root script are planned interfaces, not existing commands.

Run narrow tests while iterating. Once at release closeout, run build, formatting,
lint, type checks, TS/native tests, `bun run lab:exports`, and the installed journey. Repeat only if a
subsequent change or failure warrants it. No speculative Docker/cross-platform
suite for this Mac-only native product.

## Final acceptance

From the installed local app/CLI outside the checkout: record localhost narration
with cursor emphasis, optional browser audio, a pause, a filler and the phrase
"this is free". Show processing status immediately. The external AI reads the
transcript/index, sees returned images, fetches another frame, identifies the phrase
and any filler the engine emitted, submits revision-bound cuts, previews/listens, encounters a stale edit,
and undoes. Export both choices, move/reopen the package, request a new timestamp.
Also demonstrate interrupted recovery, failed transcription retry, disk accounting,
and deletion without recreating artifacts. No app implementation is complete until
this journey has real evidence or explicitly reported unresolved user-dependent gates.
