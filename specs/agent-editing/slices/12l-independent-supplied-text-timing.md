# 12l — Independent supplied-text timing

Status: the fixed case completed with full correspondence and scoped timing
criteria met; full evaluator remains pending and parent 12 stays open. This is one
candidate characterization, with no ASR discovery, adoption or broader quality
claim. The exact pre-dispatch plan is retained in the case evidence.

Ask whether the preserved Qwen3 MPS/float16/English candidate improves timing for
the complete frozen official LXC/arctic_a0018 utterance. Supply only the five
actual12k recognized words, in their original order. Human-corrected word edges
enter scoring afterward, never the aligner. Preserve every returned span and all
ten signed edge errors/differences against saved ASR 40/160/160ms median/p95/max.
Use the unchanged shared timed evaluator and100/250ms criteria; its full pending
coverage/audition verdict remains visible even if the small numerical case passes.

The original audio is mono Int16 PCM44100Hz/71508frames. Frozen0a
`media.sourceAudio` reads its whole exact `[0,238360000/147 us)` interval and
publishes Float32 at the original rate. Before further work, prove all 71508
samples equal original Int16/32768, with zero origin, mono, complete sample range
and no unavailable support. This is a format bridge, not a new resampler.

Then run the unchanged `media.convertSelectedAudio` finite converter to mono16k.
Verify its actual receipt/header/payload: expected25943frames,1.6214375seconds.
That terminal clock is59.099us shorter than original support and one frame fewer
than saved ASR 25944. No padding, crop, gain or timestamp adjustment is permitted;
do not claim byte equivalence with unavailable recognizer-internal PCM.

Reuse the exact executed12i namespace
`/Users/david/.cache/screen-recorder/verification/sentence-alignment-12i-beecd927`,
its8 model files,26794 runtime entries and previously executed interpreter. A
case copy of the current generic entry/shared inventory helper restores only the
two float16 precision literals. Its model/input/English/MPS/numerical sequence
matches the frozen recipe while inventory uses the current relative-root owner.
Never edit the original runner, empty receipt, prepared models or runtime. Pin
all actual inputs/runtime/source before and after; older historical Python/wheel
byte identity remains unknown.

Exactly one bridge, one finite conversion and one alignment are authorized.
Native operations each have180s bounds; alignment inherits900s/4GiB. Stop at
the first failed prerequisite, retain actual commands/PIDs/close/exit and partial
outputs, and never retry unchanged. Fresh caches and all CC BY-NC audio, full
human reference and row-level scoring stay outsideGit for private noncommercial
research. Git may retain our producers/recognition/candidate result, aggregate
metrics and provenance pointers. No preparation/download, model or recipe change,
capture/playback/UI, worker build, full suite or performance cohort belongs here.

Root owns shared hubs and integration. [Case evidence](../assets/12l-independent-supplied-text-timing/README.md)
will retain the scoped result or failure and the unchanged original authorities.
