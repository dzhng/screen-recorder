# Public product-skill inspection

Project `8f077c2a-90b8-4239-b6d7-9b5858a276b4`, pinned revision `8961ad2b-6d2b-4f39-9f4a-4bc1c214775e`. Only supplied skill, CLI advertised help, public operation receipts and delivered PNGs were used. No repo implementation, specs, tests, other reports, capture, playback, or project mutation was accessed. Reads did prepare derivative evidence.

## Authored timing versus rendered evidence

`revision.json` describes a 160×96 black canvas at 10 fps, with two video tracks:

- Base: clip ID ending `:2`, track order 0, asset `66f88c284621ef2d552f0e13edd976ebfb1ad2b29c737829380a7358e4d6a776`, stream `track:1`, authored placement [0,6) seconds, source hold at 0.
- Overlay: clip ID ending `:3`, track order 1, asset `28e5519b7cfae58e3fa9e0b46884188335fe3b9a6918cfe70d5d7e83b3097253`, stream `track:1`, authored placement [2.25,3.25) seconds, source range [0,1) seconds. Its enabled geometry stretches it to x=120, y=24, width=32, height=56.

Those placements describe the document. They do not themselves prove visible pixels at every time in the placement.

I opened all seven delivered index PNGs, the two non-grid direct boundary PNGs, and all four interior direct PNGs. The base-only pictures show a large white L shape and separate white square near the upper right on black. Overlay pictures show an added white stepped vertical shape on the right, with black portions covering some of the base's right end. The base remains visibly present in these composite pictures. This naming comes from the pictured differences and their returned layer provenance, not from source file names.

## Complete screenshot index and coverage

Index generation `a41c2b4e-b53a-4088-a53b-f7071d3d0deb`, processed output tap, maxLongEdge 480. Delivered pictures remain 160×96: the bound did not upscale or change the authored canvas. All seven entries and all eleven coverage rows were fetched through returned cursors (entry pages size 2; coverage pages size 3). Every `index.frames` item succeeded and delivered a PNG. The index is ready, but its coverage is explicitly sparse.

| Ordinal / image | Sample time (s) | Proven displayed range (s), half-open | Visible picture |
|---|---:|---|---|
| 0 / index-images/01.png | 0 | [0,0.1) | Base only |
| 1 / index-images/02.png | 2.2 | [2.2,2.3) | Base only |
| 2 / index-images/03.png | 2.3 | [2.3,2.4) | Base + overlay |
| 3 / index-images/04.png | 3.2 | [3.2,3.3) | Base + overlay |
| 4 / index-images/05.png | 3.3 | [3.3,3.4) | Base only |
| 5 / index-images/06.png | 5.0 | [5.0,5.1) | Base only |
| 6 / index-images/07.png | 5.9 | [5.9,6.0) | Base only |

The index marks [0.1,2.2), [2.4,3.2), [3.4,5.0), and [5.1,5.9) unproven. The fact that source scene preparation found zero boundaries does not turn those intervals into demonstrated unchanged output. Likewise, a hold in the document is not continuous rendered verification.

## Direct frame checks

`boundaries-1.json` and its images establish:

- Request 2.25 s returns global sample 2.2 s with full displayed range [2.2,2.3), base only. The authored start is inside this displayed frame. The sampled visible entrance is at 2.3 s, verified by the neighboring frame.
- Request 3.25 s returns global sample 3.2 s with full displayed range [3.2,3.3), base + overlay. The authored end is inside this displayed frame. The sampled visible exit is at 3.3 s, verified by the next frame.
- Direct requests at 2.2, 2.3, 3.2 and 3.3 s agree with index picture provenance. Requested atUs is not necessarily frame.sampleAtUs.

`interior-1.json` and its four opened PNGs add base-only evidence for [1.0,1.1), [4.0,4.1), and [5.5,5.6), plus base + overlay evidence for [2.7,2.8).

Across all inspected pictures, base visibility is established only over the union of those eleven distinct 0.1-second displayed ranges. Overlay visibility is established over [2.3,2.4), [2.7,2.8), and [3.2,3.3); its absence is established in the other inspected ranges. Remaining rendered evidence is unknown over [0.1,1.0), [1.1,2.2), [2.4,2.7), [2.8,3.2), [3.4,4.0), [4.1,5.0), [5.1,5.5), and [5.6,5.9). I do not claim continuous overlay presence from 2.3 through 3.3, or continuous base visibility across all six seconds. The local boundary transitions are established, but additional events inside uninspected gaps are not ruled out.

The provenance also separates compiled source requests from decoded samples: overlay sample at project 2.3 s requests source 0.05 s but decodes actual source 0; at project 2.7 s it requests 0.45 s and decodes 0.4 s; at project 3.2 s it requests 0.95 s and decodes 0.9 s. Base pictures decode source time 0. These are valid sampling distinctions, not contradictory timestamps.

## Usability and failures

No CLI operation failed and there were no per-image errors. Initial index reads progressed from a source-scenes dependency to index processing and then ready; same pinned selection was polled. Initial direct frame batches included processing/queued items; they became ready on the next poll without retries. The full help is very large and my first attempt to print it was tool-output truncated; the complete help had already been saved to help.txt, so subsequent inspection filtered that saved public schema. No missing evidence was inferred from that truncation.

The supplied skill's distinction between authored boundaries, requested instants, global frame samples, and full visibleRange was essential here. The tiny image shape is not semantically identifiable as a real-world subject; I use geometric descriptions only. I did not inspect raw sources or isolated processing taps, so the report describes the delivered output composition.

## Evidence files

`commands.jsonl` records each service invocation and its exact saved stdin parameters. `query.py` contains the small public-CLI wrapper; *.params.json, *.json and *.stderr.txt retain each request/response. `help.txt` is complete advertised help and `selected-help.json` is a filtered portion. `skill-input.md` preserves the supplied skill. `index-2.json` through `index-5.json` are all ready entry pages; `all-entries.json` aggregates them. `coverage-0.json` through `coverage-3.json` are all coverage pages. `index-images/`, `boundaries-0-images/`, `boundaries-1-images/`, and `interior-1-images/` contain delivered bytes. `images-manifest.json` records each saved PNG's size and SHA-256. No files were obtained by reading internal cache paths; the CLI --output delivered all PNGs.
