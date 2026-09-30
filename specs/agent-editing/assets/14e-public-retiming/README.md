# Public retiming delivery evidence

This isolated CLI/MCP journey exercises linked picture and sound through authored edits, delivered media, and a portable retained package. Its source counter and single-frame event flashes expose which physical picture was delivered; independently decoded PCM and AAC energy expose where sound landed. The complete result is green after the exact picture-clock repair in 14f.

The [manifest](manifest.json) binds the harness, native worker, runtime, reports, and visual files. The compressed [final report](report.json.gz) retains public exchanges, receipts, input hashes, fixed timing tolerances, all 135 decoded video counters, 18 frame captures, and every assertion result. The [earlier report](before-picture-fix-report.json.gz) preserves the failing fractional picture-clock result; long embedded media strings are replaced with length and hash. Temporary paths are provenance, not portable dependencies.

The journey covers linked middle-span retiming with ripple; unchanged neighbors; full versus split and fractional subrange PCM; a pure split; a repeated occurrence; a second rate change; explicit unlinking; independent sound duration and pitch-follow; picture replacement; gain after stretch; prepared reuse and invalidation; cancellation at the real native reply barrier and explicit retry; unchanged source bytes, waveform and scene evidence; and matching decoded preview/export media. Complete decoded video hashes cover all 135 frames before and after each independent audio-only edit. A fractional-start short public preview retains counters 44, 45 and 46 from full project frames 48–50, with all three attachment markers present. Unsupported tiny retained runs are refused before job admission for audio preparation, audio retrieval, preview and export. That zero-job check reads an isolated catalog after public calls; it does not seed data.

The processed package is adopted in a fresh service after removing the donor home and moving original source paths. Retiming capability and preflight calls are disabled in the receiver. Playback succeeds through the retained operand, with zero source decode work and matching PCM. This verifies the retained edited head; it makes no claim about resuming arbitrary historical revisions without their media.

## Visual evidence

[Before the edited span](before-side-by-side.png), [first stretched event](event-one-side-by-side.png), and [second stretched event](event-two-side-by-side.png) compare physical source pictures with delivered linked pictures. The [archive](visual-evidence.tar.xz) contains all 18 full captures and enlarged crop sheets, three contact sheets, six reference/candidate pairs, their mapping, and objective comparison metrics. Counter/event crops have zero pixelmatch differences; attachment labels are the intended visible differences. Small global color conversion differences are recorded by the grayscale metrics.

A fresh agent saw only neutral full captures and crops. It found matching paired counters and event labels, readable markers, and no missing content or corruption. Its first pass identified a crop-only truncation of the green corner block. The evidence crop was extended to the frame edge; a second inspection of all 18 updated sheets found no new visible defects and confirmed complete labels and corner blocks. Thin colored edge fringes were visible in both members of the pairs and did not obscure content. They are outside this timing and attachment check. The curated comparison set was also opened together in Preview for a non-blocking human review checkpoint.

The [short preview movie](linked-preview.mp4) preserves the technical audiovisual result. This is not a perceptual stretch-quality listening acceptance; that belongs to the separately accepted speech examples. AAC event alignment uses a fixed one-frame interval plus half the stretched burst width and one audio sample. This tolerance was declared before rendering and was not widened to obtain green. A preliminary query oracle that used the unsnapped request time was corrected to the actual project frame clock; the separate one-microsecond production boundary defect remained red until 14f.

## Reproduce

From the repository root, build the CLI/service dependencies, then run the harness with a frozen native worker and a fresh output directory:

```sh
bunx turbo build --filter=@screenrec/service... --filter=@screenrec/cli...
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/retiming.mjs --case linked-and-independent --out /tmp/retiming-fresh
```

The harness generates its fixtures and uses existing public transports and native barrier observers. It does not install a helper or model or use live capture. `render-visual-evidence.py` records the evidence assembly recipe used on this host; its bundled-runtime paths must be adjusted on another machine. Container creation timestamps may differ across runs, so preview/export comparison pins decoded pixels and PCM rather than encoded container bytes.
