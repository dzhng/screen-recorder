# Project screenshot-index coverage inspection

Project `3127a330-da02-4726-a5a2-04c5bdd535e3`, pinned revision `e3ea8116-cd85-4b96-ba58-5fe54a1404cd` (ordinal 1). The index is for the whole 6,000,000 µs project, processed output, 160×96 canvas at 10 fps. Its generation is `25f23c6d-6c1c-4176-b610-f342e91cc1e6`; there are seven retained images and eleven coverage intervals.

## Composition and presenter

The authored base clip occupies project `[0, 6,000,000)` µs and is a hold at source time 0 on video track 0. It supplies the persistent black canvas with a white L shape and a separate white square. The second video clip is the presenter overlay: it occupies project `[2,250,000, 3,250,000)` µs, uses source `[0, 1,000,000)` µs, and is placed on video track 1. Its enabled geometry step stretches it into rectangle `(x=120, y=24, width=32, height=56)` on the canvas. The sampled combined images show a small white/black glyph in that rectangle, consistent with the overlay. This identifies the authored presenter interval; the revision alone does not prove that every source instant contains an actual person.

The selected screenshots visibly establish the base graphic at project samples 0, 2.2, 3.3, 5.0, and 5.9 seconds. At 2.3 and 3.2 seconds, both the base and overlay layers are present in the returned frame provenance and the overlay glyph is visible. In particular, the index sample at project 2.3 seconds maps the overlay request at source 50 ms to actual source sample 0; at project 3.2 seconds, the requested source 950 ms maps to actual source 900 ms. Keep those actual sample times distinct from the requested/project times.

## Exact indexed coverage

`index.coverage` returned these project-time ranges. All values below are microseconds; intervals are half-open.

| Project interval | Index evidence |
| --- | --- |
| `[0, 100,000)` | sampled, ordinal 0 (sample at 0) |
| `[100,000, 2,200,000)` | unproven |
| `[2,200,000, 2,300,000)` | sampled, ordinal 1 (sample at 2,200,000; base only) |
| `[2,300,000, 2,400,000)` | sampled, ordinal 2 (sample at 2,300,000; base + overlay) |
| `[2,400,000, 3,200,000)` | unproven |
| `[3,200,000, 3,300,000)` | sampled, ordinal 3 (sample at 3,200,000; base + overlay) |
| `[3,300,000, 3,400,000)` | sampled, ordinal 4 (sample at 3,300,000; base only) |
| `[3,400,000, 5,000,000)` | unproven |
| `[5,000,000, 5,100,000)` | sampled, ordinal 5 (sample at 5,000,000; base only) |
| `[5,100,000, 5,900,000)` | unproven |
| `[5,900,000, 6,000,000)` | sampled, ordinal 6 (sample at 5,900,000; base only) |

Thus, the retained pictures establish sampled visibility of the presenter overlay only over `[2,300,000, 2,400,000)` and `[3,200,000, 3,300,000)` µs, around the authored overlay interval's edges. They do not establish its continuous visibility or unchanged appearance over the rest of `[2,250,000, 3,250,000)`. Within the authored overlay interval, `[2,250,000, 2,300,000)` and `[2,400,000, 3,200,000)` remain unproven. The sampled overlay cell `[3,200,000, 3,250,000)` is covered by the index cell `[3,200,000, 3,300,000)`, whose representative sample is at 3.2 s before the overlay ends. The post-overlay sample at 3.3 s is base-only. Therefore the index evidence does not establish the exact overlay exit picture at 3.25 s. Outside the overlay, the base hold is authored for the full six seconds, but visual constancy is sampled only on the listed ranges; every unproven range leaves picture appearance unestablished by this index.

The `index.get` page candidate ranges correspond to the ten-frame/100 ms sampling cells. The returned encoded frame metadata itself reports a 1 µs visible range for most sampled frames; the coverage endpoint is the evidence for the indexed 100 ms cells. Neither representation proves intervening pictures beyond its stated interval.

## Artifacts and invocation notes

Raw CLI help is saved as `help.json`; the narrowed index operation schemas are in `relevant-help.json` and `coverage-help.json`. Public response receipts are saved as `project.get.json`, `revision.get.json`, `index.get.json`, `index.get.poll1.json`, `index.coverage.json`, and `index.frames.json`. All seven returned PNGs are in `images/` (`01.png` through `07.png`). Representative PNGs 01, 03, 04, and 06 were visually inspected: they show the base-only graphic, overlay entering, overlay near its authored end, and base-only later in the project.

The first `index.get` call mistakenly included `--output`; the CLI returned `INVALID_REQUEST` (“--output applies only to artifact inspection operations”). I reran `index.get` without it. The initial valid read returned `processing`, and the identical pinned read then returned `ready`. No mutation, capture, or playback operation was used.
