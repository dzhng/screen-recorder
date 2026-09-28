# Project screenshot-index inspection

Project `3127a330-da02-4726-a5a2-04c5bdd535e3`, pinned revision `e3ea8116-cd85-4b96-ba58-5fe54a1404cd` (ordinal 1), is a 6-second 160×96, 10 fps composition on an opaque black canvas. Track 0 holds one source picture at source time 0 for the full 0–6 s. Track 1 places a second clip from source 0–1 s over project time 2.25–3.25 s. The sampled base picture is a black field with a white right-angle shape and two white squares. The second source is a coarse white stepped silhouette on black; at this 24×40 source size it does not show identifiable facial or clothing detail.

The presenter layer enters at 2.25 s and exits at 3.25 s by the pinned edit document. Output-index samples bracket those transitions: 2.2 s is marked before the start; 2.3 s is marked after it; 3.2 s is before the end; 3.3 s is after it. The images at 2.3 and 3.2 carry the second clip as a visible layer in their provenance. The 2.2 and 3.3 output samples show only the held base layer. These are edge samples around the authored half-open placement, not continuous observation of every instant.

The overlay clip has one enabled geometry step: destination rectangle x=120, y=24, width=32, height=56, with `fit: stretch`. Processing capabilities report geometry execution available (`native-composition-movie-v3`). Comparing the dry and processed overlay index images at 2.3 s shows the stepped white silhouette in its raw centered position in the dry tap, then positioned toward the right of the 160×96 inspection canvas in the processed tap. The processed output index is the composed view; the dry clip tap isolates that clip's stack and therefore does not show the base track. The image evidence supports a placement/size change. It does not establish that the small silhouette is a recognizable presenter.

The project index reports 7 selected samples across the 6-second revision, with samples at 0, 2.2, 2.3, 3.2, 3.3, 5.0 and 5.9 seconds. Coverage counts are 11, while each delivered entry reports coverage count 1. Those are sparse samples and their visibility windows, not proof that the picture stayed the same through all unsampled intervals. In particular, an index sample around each overlay edge corroborates the transitions; gaps between samples remain unproven. The held-source edit mapping supports the base-picture duration, while the screenshot samples themselves establish only their sampled visibility.

## Images inspected

- Composed output, before entry: [2.2 s](images-output/01.png)
- Composed output, after entry: [2.3 s](images-output/02.png)
- Composed output, before exit: [3.2 s](images-output/03.png)
- Composed output, after exit: [3.3 s](images-output/04.png)
- Overlay dry tap at 2.3 s: [dry](images-dry/02.png)
- Overlay processed tap at 2.3 s: [processed](images-overlay-processed/02.png)

Raw CLI help and operation receipts are saved in this directory, including `help.json`, the project and revision reads, processing/capability reads, initial pending and ready index reads, job receipts, failed first image-fetch receipts, and successful image-fetch receipts. The three successful `frames-*-stdin.json` receipts tie the local PNGs to their index generation and ordinal.

## Confusion and failures encountered

The first `index.frames` calls used `--params @/path`, which the CLI rejected with `INVALID_REQUEST` because it treated that string as JSON. I retained the failed receipts and retried with `--params -` and piped JSON, as the supplied skill documents. Initial index reads also returned `processing` or `queued`; polling the returned source-scene and screenshot-index jobs showed both became ready, and repeating the same pinned reads returned ready pages. Pillow was unavailable for making a contact sheet; I inspected the fetched PNGs directly and enlarged copies with macOS `sips`. No project mutation or capture operation was issued.
