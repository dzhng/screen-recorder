# State input binding evidence

The [checkpoint](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/15a2c-state-input-bindings.md) verifies exact source binding and metadata admission before native RNNoise execution. The archive contains declared-probe fixtures and three generated PCM WAVs, with matched requests, state manifests, file bindings and refusals. These are not native probe, rendered DSP, listening or learned-publication evidence.

Focused verification passed 276 composition/core/prepared/asset tests, with one native-only test deliberately skipped. Composition/core typechecks, CLI dependency build and three help checks passed. Independent code review found no concrete defect and separately ran 33 focused tests with one skip. Existing prepared lifecycle tests stay green; no fake successful RNNoise backend was introduced to claim that lifecycle is newly proven for learned processing.

Original red regressions retain missing exact consumed-support spans, the absent earlier asset binding in a narrow request, and an omitted out-of-range retime requirement. A negative control removes the state input admission call; stereo/unknown and missing-support assertions fail, then pass with the actual source restored. The requirement owner now preserves the same retime rule for ordinary and state prerequisite inputs, without adding stretch execution.

The trace distinguishes complete mono sources, an acquisition hole inside consumed input, a declared stereo source, an unknown channel probe, and an authored window restricted to the later source. Mono plus equal-channel gain and authored silence passes the structural premise but still refuses at unbound RNNoise. The missing acquisition interval remains explicit; the restricted window excludes that earlier source entirely. The test suite also preserves disjoint consumed spans instead of filling their intervening source hole and verifies pinned old context after a narrower recipe is constructed.

Source format is copied from the stored probe, not inferred from the stereo rendition. A missing channel declaration is deliberately unknown even when a fixture file's header can be inspected. Actual native opening must verify the declared premise in the next gate. The fixture replay uses Node 24 and compiled core/composition modules; Bun cannot run its `node:sqlite` imports. Local paths in the retained replay and logs are provenance, not portable defaults.

Project bindings and the private prepared dependency collector use one media-input union. Full native learned job publication, resource retention under that backend, model-free learned reads, channel PCM parity and cancellation remain the next integration gate. Missing selected support blocks new learned execution rather than authorizing padding; retained inspection keeps its existing independence from current backend availability.

`manifest.json` records every archived member's SHA-256 and byte count; `SHA256SUMS` authenticates the archive and manifest. Reproduce the focused gate after building composition:

```sh
bun run --cwd packages/composition build
env -u SCREENREC_NATIVE bun x vitest run packages/composition/src packages/core/src/projects.test.ts packages/core/src/project-audio.test.ts packages/core/src/prepared-audio.test.ts packages/core/src/assets.test.ts
bun run --cwd packages/core check-types
```
