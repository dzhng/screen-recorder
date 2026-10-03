# Fresh raw-image skill test

Completed using only the supplied skill, CLI help/responses, and images delivered through CLI `--output`. No input image was opened directly. No repository code, specifications, tests, internal service files, capture, playback, or project operations were used.

## Results

| Imported file | Admitted encoded dimensions | Admitted upright dimensions | Source orientation | Full delivered PNG | maxLongEdge 32 PNG | Transparency |
|---|---|---|---|---|---|---|
| diagram.png | 64×40 | 40×64 | 6 | 40×64 | 20×32 | Preserved alpha; 0, 128, 255 observed |
| card.jpg | 64×40 | 64×40 | 2 | 64×40 | 32×20 | Opaque; RGB PNG output, no alpha channel |

“Full” requests omit maxLongEdge. The receipt reveals an effective default of 1600; because these sources are only 64 pixels on the long edge, their delivered sizes match admitted upright dimensions without upscaling. The smaller request halves each dimension and preserves aspect ratio. Inspection resizing does not author a crop or project edit.

The receipt's `frame.sourceWidth/sourceHeight` describe upright dimensions: diagram reports 40×64 there, while asset.get reports encoded width/height 64×40 and separate oriented dimensions 40×64. Calling both pairs simply “original dimensions” would be ambiguous.

## Appearance and orientation

I opened all four delivered PNGs individually with the image-viewing tool. The diagram is a portrait arrangement of colored corner blocks: yellow upper left, red upper right, blue lower left, green lower right, with a small white center block and transparent surrounding space. Pixel inspection establishes that the center white block has alpha 128, not fully opaque white; other pixels include alpha 0 and 255. Both sizes retain those alpha values and corner placements.

The card is a landscape arrangement: green upper left, red upper right, blue lower left, yellow lower right, a white center block, and an opaque dark background. Both delivered sizes retain that layout. Delivered JPEG-derived colors are close to the primary colors rather than exact (e.g. upper-left RGB 0,254,1).

The skill and CLI describe the delivered PNG as already upright. Both image receipts retain source orientation 6 or 2 even though those source orientations have already been applied to delivery. Diagram's dimension swap is consistent with that normalization. The card's unchanged dimensions do not mean no orientation metadata exists: it retains orientation 2. I did not independently compare encoded input pixels or claim an original encoded corner layout, since directly inspecting inputs was prohibited. No further rotation or mirroring of delivered images was applied.

## Provenance

Both assets were admitted as decodable `image:0` streams of kind `image`, with codecs `public.png` and `public.jpeg`. `asset.origins` reports exactly the respective supplied input path and `nextCursor:null`. IDs were copied programmatically from import-job receipts to subsequent requests:

- diagram: `b7723ef2e3ef8f6afa41811aaa819362e903a9c17448bcd9e58612fd913d3c12`, imported bytes 353.
- card: `8cc9d696228045442ae3a6fe6aa746b506c7a6f52645d12602f1d1501000d00c`, imported bytes 1133.

All deliveries report `native-source-image-v1`, generation 1, decodedImages 1 and readerOpens 1. Full/small delivered byte sizes are 320/250 for diagram and 324/252 for card. Receipts preserve asset/stream, job/cache identity, source orientation, alpha flag, output dimensions and delivery details. No acquisition, timestamp, recording, project revision, or sample clock was supplied. Asset metadata contains originUs:0; that does not give a still image a sample clock. These are raw-source inspections, not evidence of project still-image compositing, crop/zoom, processing or pointer overlays.

## Workflow, confusion, errors

The supplied skill's raw-image guidance was sufficient: inspect admitted kind, use assetId/streamId, omit atUs/acquisitionId, and request each image individually. I used the explicitly supplied Node launcher rather than assuming a globally installed screenrec binary. CLI help clearly advertises --socket and --output. The large general help contains many irrelevant operations; I filtered the saved public help to asset/job/frame schemas.

Both import operations first returned running; job.get subsequently returned ready. Each frame request first returned processing with no delivery; polling the identical selection returned ready and wrote the requested file. All 16 product calls exited 0; no API errors, explicit retries, or canceled/failed jobs occurred. The implicit maxLongEdge=1600 and distinction between encoded dimensions and upright sourceWidth/sourceHeight were the only interpretation points requiring attention.

An auxiliary local pixel-inspection attempt failed because Python Pillow was unavailable (`ModuleNotFoundError: No module named 'PIL'`). I did not install anything. The saved stdlib-only PNG inspector then decoded only the delivered PNG files and saved pixel evidence. This was a local tooling error, not a product error.

## Saved evidence

- `help.json`: complete public interface description.
- `commands.sh`: exact product commands with request/stdout/stderr paths.
- `*.request.json`, `*.response.json`, `*.stderr.txt`, `*.exit.txt`: every product call and poll.
- `diagram-full.png`, `diagram-small.png`, `card-full.png`, `card-small.png`: unmodified CLI deliveries, all visually inspected.
- `inspect-delivered.py`, `delivered-pixel-inspection.json`: reproducible delivered-file dimensions, PNG color types, alpha values and sample pixels.
- `run.py`: public CLI invocation/receipt logging helper.
- `auxiliary-error.txt`: failed optional Pillow attempt.
