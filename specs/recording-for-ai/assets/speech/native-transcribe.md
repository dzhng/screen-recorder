# Native `speech.transcribe` plumbing lab

**Synthetic speech proves plumbing only.** Narration here is macOS `say` output, so
the run shows that the worker loads the pinned model offline, reads only acquired
intervals, maps words back into source time and matches the evaluated CLI. It says
nothing about accuracy, fillers or timing on real narration; that stays with P6.

Counts, hashes, the full response and every word are in
[native-transcribe.json](native-transcribe.json). The lab is
`helpers/mac/Tests/speech-lab.mjs`, run against a cache from
`node scripts/speech-eval.mjs prepare parakeet CACHE` whose 22 model files matched
the digests in [parakeet-synthetic.json](parakeet-synthetic.json).

## Setup

- The narration movie holds two spoken phrases and a 0.2 s fragment at 48 kHz mono,
  separated by empty edits of 2 s and 1 s.
- The track starts 1.5 s into the recording, and acquisition evidence claims the
  whole span, gaps included.
- The worker was the release `screenrec-native` from the app bundle. It and the
  pinned `fluidaudiocli` both ran under `sandbox-exec` with `(deny network*)`.

## What it shows

- **Segments are exactly the occupied intervals.** Two were transcribed and the
  fragment was `skipped` with reason `too_short`. The empty edits became no segment,
  and no word falls inside either gap.
- **Words map back to source time.** Each word lies inside its own segment. The first
  word starts at the segment start. The last word's engine end ran past the audio and
  was clamped to the segment end.
- **CLI parity holds.** Each transcribed interval was exported through the worker's
  own `media.audio` excerpt at 48 kHz and transcribed by the pinned CLI. Text and
  merged words were identical, and every word start and end differed by 0 s against
  a tolerance of one 80 ms encoder frame. Both phrases matched their script.
- **Nothing reached the response channel.** A ping after the transcription on the
  same worker process answered as the second and last stdout line. Before the worker
  diverted stdout, Core ML's E5RT shape-inference message landed after the response.
- **Cold resource use.** Peak resident set was 539 MB. The call took 14.6 s
  including model load. Neither number is a warm measurement.
