# Explicit fade and zoom conveniences

Scoped public delivery passes; whole slice16 and encoded quality remain open.
`fade` and `zoom` expand into ordinary processing steps inside the existing atomic
batch. The reducer owns expansion; get/set, clocks, validation, native execution
and revision receipts retain their existing owners.

The [fade journey](../../../../packages/test-harness/editing/conveniences.mjs)
drives CLI writes and MCP writes/reads against an isolated service and native
worker. Its [report](fade/report.json) records exact sample-wise linear gain,
dry neighbors, range slices, bypass, incompatible-medium atomic refusal, paired
summed audio and video fade/static-opacity PNG controls. The fixture is synthetic;
these checks do not establish perceived loudness or speech-join quality.

The [keyframe journey](../../../../packages/test-harness/editing/keyframes.mjs)
accepts `--case moved-split-zoom --convenience` to author through `zoom` while
retaining independent static controls and existing move/split/trim/window and
full/range preview/export checks. Its [report](zoom/report.json) retains 39 exact
PNG comparisons and the inherited movie membership tolerance. That tolerance is
not strict encoded color acceptance; prior movie edge/color limitations stay open.

[Fresh visual review](visual-review.md) inspected all 55 retained PNGs enlarged.
No rendering defect was confirmed. The reviewer flagged abrupt changes at window
edges for semantic confirmation: these are intended because the processor is dry
outside its explicit half-open window. An interior fade-out returns to dry level;
callers who want a held terminal value author ordinary keys through that interval.
No movie-derived PNGs were in this critique, so movie visuals remain unreviewed here.

Composition checks pass 197 tests; all repository type checks and the whole build
pass. Final harness reruns retained byte-identical PNGs to the reviewed set. Independent `codex review --uncommitted` reported no actionable findings.
A deliberate wrong-start-value mutation made all four convenience tests fail;
restoring the original passed all four. Shape review retained one expansion before
the shared stack setter, avoiding a separate persistence or render path. Diff
and documentation reviews found no remaining issue. The initial public harness
[parameter error](initial-harness-failure.json) came from sending an unsupported
`revisionId` beside `expectedRevisionId`; removing that harness-only field exposed
the actual public path and all checks passed.

Reproduce after building, using a frozen native worker in `SCREENREC_NATIVE`:

```sh
node packages/test-harness/editing/conveniences.mjs --out /tmp/fade-evidence
node packages/test-harness/editing/keyframes.mjs --case moved-split-zoom --convenience --out /tmp/zoom-evidence
```

[Fresh product-skill consumption](skill-review.md) passes using public CLI
discovery only. The [complete raw evidence archive](skill-evidence.zip) retains
requests, receipts, commands, delivered PNGs and dry/processed WAVs. The agent
selected explicit geometry, confirmed ordinary returned steps and inspected
before/inside/after frames and PCM, with no refused requests. Acoustic listening
was unavailable and remains unverified. Retimed audio retains its existing
`NOT_READY` contract; denoise transitions, all-slice journeys
and quality policy are separate work.
