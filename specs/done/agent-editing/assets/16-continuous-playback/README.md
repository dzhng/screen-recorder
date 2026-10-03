# Continuous offscreen playback

These reports distinguish actual timed `AVPlayer` output from offline decoding or
player readiness. The player runs muted at rate one, with no window or display
layer. Every delivered video buffer is matched by its presentation timestamp to
an independently sequentially decoded frame from the same movie. A spatial RGB
grid must match exactly; all decoded timestamps must appear once in increasing
order. This checks playback delivery, not authoring correctness or full-image
color equivalence.

The [probe](../../../../../packages/test-harness/editing/ContinuousPlayback.swift)
uses Apple's [video output API](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput).
Its three-second startup deadline and frame-cadence-plus-250ms forward-progress
allowance are bounded probe gates, not a universal smoothness standard. Actual
wall times, player progress/state, received timestamps, missing frames, stalls and
completion are retained in each compressed report. The
[runner](../../../../../packages/test-harness/editing/continuous-playback.mjs) bounds
the entire probe process as well as its playback loop.

Run against an already delivered local movie:

```sh
node packages/test-harness/editing/continuous-playback.mjs /path/to/movie.mp4 /tmp/playback-evidence
```

[Linked](linked/report.json.gz) and [independent](independent/report.json.gz)
retiming pass: each movie supplies all 135 decoded frames, exactly matching the
RGB grid, without stall notifications. The moved/retimed/split zoom
[full movie](zoom-full/report.json.gz) and [ranged movie](zoom-range/report.json.gz)
supply all 90 and 25 frames respectively with the same exact grid and no stalls.
The reports retain media and probe hashes;
[verification](verification.json) ties them to public delivery provenance and
review. Movies remain outputs of the existing public retiming harness rather than
new fixture copies here.

The [negative controls](controls) exercise the actual probe with disposable source
mutations recorded in each report. Readiness without `play()` fails. Pausing an
active player fails the forward-progress bound. Comparing each observed frame
against the next decoded frame fails the pixel check even though playback reaches
the end with every timestamp observed. No negative hook enters product code or
the shipped probe.

This is **muted offscreen continuous playback evidence**. It does not establish
physical display presentation, human-perceived smoothness, audible quality,
audio/video synchronization, installed-player behavior or complete slice16
acceptance. No capture, app installation or native product rebuild is involved.

[Independent root replay](root-linked.json.gz) repeats all135 linked frames with
exact sampled RGB, bounded forward progress and completion on integrated sources.
