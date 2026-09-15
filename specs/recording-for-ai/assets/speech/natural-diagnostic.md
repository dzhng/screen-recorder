# Natural human speech diagnostic

Both pinned candidates were run offline over the same four AMI clips of real
meeting speech (~296 s, 185 annotated `um`/`uh`, 23 truncated false starts).
Counts, hashes, commands and raw-output paths are in
[natural-diagnostic.json](natural-diagnostic.json); the fixture's provenance is in
[ami-candidate.md](ami-candidate.md).

## What it shows

Parakeet transcribes disfluently and WhisperKit transcribes fluently. WhisperKit
emitted **zero** `um`/`uh` tokens across every clip, rewriting hesitant speech into
clean prose — `"Um 'kay um yeah uh some uh research"` became `"I did some
research"`, and it dropped nine consecutive reference tokens at 479.6–489.0 s
rather than emit the hesitation. Parakeet reproduced most of them, including
repeats (`"uh uh to do in"`) and stacked fillers (`"So uh um uh that's"`).

This is a property of the decoder's language prior, not of its word-timestamp
support. A model that never emits a filler cannot be rescued by alignment
refinement: forced alignment cannot invent an omitted word. That is the only
conclusion this run licenses, and it is about **verbatim emission**, not about
timing.

Both engines also delete short truncated false starts (`w`, `sen`, `ch`) and
occasionally substitute a filler for a content word — Parakeet turned `uh` into
`Did`, WhisperKit turned `uh` into `did` and `um` into `9`. So neither candidate
is verbatim-clean; they differ in degree, and a filler that survives as the wrong
token is still a wrong edit range.

## What it cannot show

The acceptance gate is untouched by this document.

The reference timings are AMI's **automatic** forced alignment, so no filler
precision/recall, no boundary error, and no audition claim is reported — only
which tokens each engine emitted. Runtime and RSS came from cold upstream-CLI
processes that include model load and first-run CoreML compilation (one 9-second
clip cost 157 s wall against 21 s CPU); those numbers are invalid for the warm
resource gate, which still needs an in-process production-runner measurement.
`speech-eval evaluate` was never invoked — the clip manifests carry no
annotations, only the `run` path was used, and no manually labeled dataset exists
yet. AMI is a widely redistributed public corpus, so these clips are not held out
of either model's pretraining.

No engine is selected here.

## Reading the numbers honestly

The token error rate is measured against an annotation that covers **speaker B
only**, while the headset channel carries the whole room. Insertions therefore
mix real cross-talk with real hallucination and cannot be separated from these
artifacts. The one clip with meaningful annotated cross-talk is flagged per-clip
in the JSON; the 241-second clip has none.

Clip boundaries were placed inside gaps of ≥4 s in speaker B's annotation, and
every cut point measures below −57 dBFS over its first and last 100 ms. Since the
gaps are derived from the same automatic alignment, "no word was severed" holds
for speaker B's annotated speech and is corroborated by the level measurement —
it is not an independently verified silence.

## Next step for the gate

The gap the gate actually needs is manual labeling, not another engine run: pick
the ≥40 filler boundaries from these clips, label them by ear, and keep them apart
from the corpus alignment. Only then do precision, recall and boundary error mean
anything, and only then does an audition of returned ranges have something to
audit.
