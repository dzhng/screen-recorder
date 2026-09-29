# Fresh black-box animated-gain review

## Verdict
PASS for the selected non-retimed, clip-normalized linear gain case: complete stereo PCM matches an independent analytic envelope; splitting preserves every PCM byte; identical requests replay without advancing the head; wrong curve-clock domain refuses without a revision change. No listening or subjective audio-quality claim.

## Scope and safety
Only the supplied screenrec skill, selected-operation public CLI help, and public CLI operations informed this review. No implementation, tests, specs, git diffs, or prior reports were inspected. No repository edit/rebuild, app access, user library access, capture, model preparation, network, playback, or service shutdown was performed. Scratch files are confined to this directory; service-managed writes were requested only through the isolated service.

Every CLI invocation, including help, explicitly supplied:
`--socket /tmp/sr-gain-skill-jMRkUL/library/run/service.sock`

CLI: `node /Users/david/dev/screen-recorder/apps/cli/dist/main.js`.
Locator: `/tmp/gain-skill-service.json`; input: its supplied `source.wav`.
The externally owned service was left running.

## Concrete actions and evidence
1. Read `/Users/david/dev/screen-recorder/skills/screenrec/SKILL.md`.
2. Saved selected help for project.create/get, asset.import/get, job.get, edit.apply, audio.get, processing.capabilities in `help-*.json`.
3. Created project `50832590-4efe-4514-bac8-cd0953ae4c57` with explicit 320x240/30 fps canvas; imported the provided source, polled the import job to ready, and read the admitted stream. It advertised one second, stereo, 48 kHz (`create`, `import`, `import-job`, `asset` request/receipt pairs).
4. Read processing capabilities: gain advertised execution support and linear multiplier units (`capabilities.receipt.json`).
5. Added one audio track and placed the complete source at project [0, 1,000,000) microseconds with identical source range, hence no retiming (`place.*`).
6. Authored an ordinary `processing.set` clip step, not the fade convenience operation: explicit linear keys (normalized 0/1, gain 0.2) and (normalized 1/1, gain 0.8); explicit normalized clip window [1/4, 3/4). Returned settings retained both keys and window (`gain.*`).
7. Requested pinned [0, 1,000,000) dry, after-step, clip-processed, and output-processed audio. Initial receipts reported processing; polled identical selections without output, then delivered only after ready. Saved all polling/delivery requests and receipts and `dry.wav`, `after.wav`, `processed.wav`, `output.wav`.
8. Split the clip at 500,000 microseconds, inside the active ramp, selecting only this clip. Inspected normalized stacks in the public edit receipt: two clips retained the keys and original fractional window, with evaluation ranges [0, 1/2] and [1/2, 1]. The left step ID persisted and the right step received an independent ID (`split.receipt.json`). Delivered complete pinned split output as `split-output.wav`.

## Independent numerical verification
`verify.py` parses delivered RIFF/WAV chunks directly with Python's standard library; it calls no application evaluator and imports no repository code. It asserts IEEE float32 stereo, 48,000 frames at 48 kHz, and compares every interleaved channel sample, not sparse probes or aggregate RMS.

From dry sample d[n,c], independently predicted:
- g(n) = 0.2 + 0.6 n / 48000 for 12000 <= n < 36000;
- g(n) = 1 otherwise;
- expected y[n,c] = d[n,c] g(n).

The window gates the curve; it does not restart its normalized clock. Thus gain starts at 0.35 when the window opens and approaches 0.65 before returning to dry at its exclusive end.

Acceptance was fixed before the first measurement: absolute error <= 1e-7 full scale for every sample, exact equality with dry outside the window, and exact PCM-byte equality across split. No threshold was changed.

Results (`verification.json`):
- Each of after-step, clip-processed, output-processed and split-output: all 96,000 scalar samples checked.
- Maximum absolute analytic error: 7.438659688219218e-9; zero samples over tolerance.
- Per-channel maxima: 3.719329844109609e-9 and 7.438659688219218e-9.
- Zero samples differ from dry outside the window.
- Split output versus pre-split output: identical PCM bytes, zero unequal samples, maximum difference 0.
- Boundary evidence includes frames 11999/12000, 23999/24000 and 35999/36000. Both channels have nonzero dry evidence; dry peaks are 0.3662109375 and 0.25.
- All five audio receipts report stereo, absolute sample range [0,48000), zero clipped samples and no unavailable support ranges.

## Replay and negative results
`state-verification.json` records machine-checked assertions.
- Immediate gain replay with identical requestId, original expected revision and arguments returned identical data and revision `c1a41600-bb2b-4367-a296-51efa183199f`.
- Split replay likewise returned identical data and revision `7c179d11-8ab1-4b7c-b21d-ae1779422b5d` (ordinal 3, two clips).
- Replaying the original gain request after splitting recovered its original receipt data without moving the current head backwards or adding a new revision.
- Invalid-domain request retained the returned step ID, window and evaluationRange but replaced fractional normalized keys with integer project-microsecond keys 0 and 1,000,000. It failed with exit 1, `ok:false`, `INVALID_EDIT`, cause `INVALID_COMPOSITION`: “Processing curve must match its clock and remain within parameter bounds.”
- Public project.get immediately before and after the invalid mutation returned the same split revision. No correction/retry was needed or silently substituted.

## Agent usability friction
- `edit.apply --help` is very large even when selecting only that operation; an initial full print was truncated. Parsing the saved schema to inspect the processing variant and gain fields avoided guessing. A processor/variant-level help selector or compact examples would reduce effort.
- Curve `keys` is marked `readOnly:true` in input schemas, despite being required and successfully authored. This annotation can mislead generic schema-driven clients.
- The numeric-or-fractional key schema exposes both clock forms without tying them to target/window choice. The skill's normalized-clip versus parent-project clock explanation was necessary. The refusal identifies the target/step but combines clock and parameter-bound errors rather than stating the expected domain.
- Polling and download are separate steps; the skill correctly warns that success envelopes alone do not prove job readiness. No terminal render failure occurred.
- Returned IDs, full stacks, replay data, evaluationRange and unavailable-support metadata were sufficient to complete the task without private implementation knowledge.
- One report-writing orchestration call failed JavaScript parsing before execution; it was corrected without repeating mutations or changing numerical acceptance criteria.

## Precise limits
This is one one-second stereo fixture, one clip-target linear attenuation curve, one interior normalized window and one split at an integer sample boundary. It does not establish correctness for cubic/hold interpolation, parent stacks, overlapping mixes, gain >1, other sample formats/rates, fractional-sample boundaries, multiple splits, content/project windows, retiming, exports, restart durability, or concurrent clients. One invalid clock combination was tested, not the full invalid-input space. Replay was explicit, not a simulated lost transport response. Source-to-dry fidelity was not separately asserted; the requested independent oracle uses delivered dry PCM. No listening, perceived loudness, click-free join, or retimed-audio quality claim is made. This is not a source-code patch review.

All request/receipt pairs, stderr and exit codes remain alongside the scripts; media hashes are in `media-sha256.json`. Public receipts contain service cache paths, but those files were not opened directly.
