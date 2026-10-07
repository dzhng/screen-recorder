# Audio preparation before picture encoding

The selected complete tap shares the existing retained audio owner and job lifecycle.
[The receipt](receipt.json) records narrow checks, falsifications and actual runtime
identities; [the slice](../../README.md) owns the verdict.
No source media or additional model artifacts are duplicated here.

Reproduce core checks with the core manifest's test command and
`src/prepared-audio.test.ts`. For real native checks, select
`movie preflight refuses` or `public prepared processing` in the service manifest's
`src/audio-processing.test.ts`, setting `YAP_NATIVE`, `YAP_FFMPEG_DIRECTORY` and
`YAP_FFMPEG_RECEIPT` to the frozen runtime identities in the receipt. The public
case uses actual service requests, dry/final preparation, retained MP4 export,
excerpt reads, runtime replacement and package adoption. It refuses any native
audio recomputation during the retained video export.

The existing movie owner already settles complete audio processing and strict
postconditions before picture encoding. This pass preserves that order rather
than adding a preflight scheduler. A deliberate early-picture mutation turns the
known-refusal tracer red. Portable dry adoption also turns red if it compiles the
final mix instead of the recorded tap.

Synthetic black movie frames test mux/publication only. They establish no visual
quality, mastering feasibility beyond the selected case, or encoded peak guarantee.

[Independent review](review.md) found no actionable regressions.
